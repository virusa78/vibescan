import { prisma } from 'wasp/server';
import type { EventCategory, EventDestinationType } from '../../shared/events';
import { eventDeliveryQueue } from '../queues/config.js';

const STALE_ROUTING_THRESHOLD_MS = 2 * 60 * 1000;

type RoutableEventRecord = {
  id: string;
  eventType: string;
  category: EventCategory;
  workspaceId?: string | null;
  userId?: string | null;
};

type MatchingSubscriptionRecord = {
  id: string;
  destinationType: EventDestinationType;
  destinationConfig: unknown;
};

type RoutedDeliveryRecord = {
  id: string;
  subscriptionId: string;
  destinationType: EventDestinationType;
  deliveryKey: string;
};

function buildSubscriptionScopeFilter(event: RoutableEventRecord) {
  const orClauses: Array<Record<string, unknown>> = [
    {
      workspaceId: null,
      userId: null,
    },
  ];

  if (event.workspaceId) {
    orClauses.push({
      workspaceId: event.workspaceId,
    });
  }

  if (event.userId) {
    orClauses.push({
      userId: event.userId,
    });
  }

  return {
    OR: orClauses,
  };
}

function getTargetRef(
  destinationType: EventDestinationType,
  destinationConfig: unknown,
): string | null {
  if (!destinationConfig || typeof destinationConfig !== 'object') {
    return null;
  }

  if (destinationType === 'generic_webhook' || destinationType === 'observability_sink') {
    const url = (destinationConfig as { url?: unknown }).url;
    return typeof url === 'string' ? url : null;
  }

  if (destinationType === 'zoho_crm') {
    const accountRef = (destinationConfig as { accountRef?: unknown }).accountRef;
    return typeof accountRef === 'string' ? accountRef : 'zoho_crm';
  }

  return null;
}

function buildInitialDeliveryKey(eventOutboxId: string, subscriptionId: string): string {
  return `initial:${eventOutboxId}:${subscriptionId}`;
}

async function enqueueRoutedDeliveries(
  eventOutboxId: string,
  deliveries: RoutedDeliveryRecord[],
): Promise<void> {
  const enqueueFailures: string[] = [];

  for (const delivery of deliveries) {
    try {
      await eventDeliveryQueue.add(
        `event-delivery-${delivery.id}`,
        {
          deliveryId: delivery.id,
          eventOutboxId,
          subscriptionId: delivery.subscriptionId,
          destinationType: delivery.destinationType,
          attemptNumber: 1,
        },
        {
          jobId: delivery.id,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      enqueueFailures.push(`${delivery.id}: ${message}`);

      await prisma.eventDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'failed',
          errorMessage: `Failed to enqueue delivery job: ${message}`,
        },
      });
    }
  }

  if (enqueueFailures.length > 0) {
    await prisma.eventOutbox.update({
      where: { id: eventOutboxId },
      data: {
        lastError: enqueueFailures.slice(0, 5).join(' | '),
      },
    });
  }
}

async function reclaimStaleRoutingEvent(eventOutboxId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_ROUTING_THRESHOLD_MS);
  const reclaimed = await prisma.eventOutbox.updateMany({
    where: {
      id: eventOutboxId,
      state: 'routing',
      updatedAt: {
        lte: staleBefore,
      },
    },
    data: {
      state: 'pending',
      retryCount: {
        increment: 1,
      },
      lastError: 'Recovered stuck routing event after stale routing timeout',
    },
  });

  return reclaimed.count > 0;
}

export async function recoverStuckEventOutboxRecords(limit = 50): Promise<{
  recoveredCount: number;
}> {
  const staleBefore = new Date(Date.now() - STALE_ROUTING_THRESHOLD_MS);
  const stuckEvents = await prisma.eventOutbox.findMany({
    where: {
      state: 'routing',
      updatedAt: {
        lte: staleBefore,
      },
    },
    select: {
      id: true,
    },
    take: limit,
    orderBy: {
      updatedAt: 'asc',
    },
  });

  let recoveredCount = 0;
  for (const event of stuckEvents) {
    const recovered = await reclaimStaleRoutingEvent(event.id);
    if (recovered) {
      recoveredCount += 1;
    }
  }

  return { recoveredCount };
}

export async function getMatchingSubscriptions(
  event: RoutableEventRecord,
): Promise<MatchingSubscriptionRecord[]> {
  const subscriptions = await prisma.eventSubscription.findMany({
    where: {
      enabled: true,
      eventTypes: {
        has: event.eventType,
      },
      categories: {
        has: event.category,
      },
      ...buildSubscriptionScopeFilter(event),
    },
    select: {
      id: true,
      destinationType: true,
      destinationConfig: true,
    },
  });

  return subscriptions;
}

export async function routeEventOutboxRecord(eventOutboxId: string): Promise<{
  matchedSubscriptions: number;
}> {
  const claimed = await prisma.eventOutbox.updateMany({
    where: {
      id: eventOutboxId,
      state: 'pending',
    },
    data: {
      state: 'routing',
      publishedAt: new Date(),
      lastError: null,
    },
  });

  const event = await prisma.eventOutbox.findUnique({
    where: { id: eventOutboxId },
    select: {
      id: true,
      eventType: true,
      category: true,
      workspaceId: true,
      userId: true,
      state: true,
      updatedAt: true,
      deliveries: {
        where: {
          manualRetryOfId: null,
        },
        select: {
          id: true,
        },
      },
    },
  });

  if (!event) {
    throw new Error(`EventOutbox record not found: ${eventOutboxId}`);
  }

  if (claimed.count === 0) {
    if (event.state === 'routed' || event.state === 'completed') {
      return { matchedSubscriptions: event.deliveries.length };
    }

    if (event.state === 'routing') {
      const recovered = await reclaimStaleRoutingEvent(event.id);
      if (recovered) {
        return routeEventOutboxRecord(event.id);
      }

      return { matchedSubscriptions: event.deliveries.length };
    }

    if (event.state === 'failed') {
      throw new Error(`EventOutbox record ${eventOutboxId} is in failed state and requires manual recovery`);
    }
  }

  const subscriptions = await getMatchingSubscriptions({
    id: event.id,
    eventType: event.eventType,
    category: event.category as EventCategory,
    workspaceId: event.workspaceId,
    userId: event.userId,
  });

  if (subscriptions.length === 0) {
    await prisma.eventOutbox.update({
      where: { id: event.id },
      data: {
        state: 'completed',
      },
    });

    return { matchedSubscriptions: 0 };
  }

  const deliveryKeys = subscriptions.map((subscription) =>
    buildInitialDeliveryKey(event.id, subscription.id),
  );

  await prisma.eventDelivery.createMany({
    data: subscriptions.map((subscription) => ({
      eventOutboxId: event.id,
      subscriptionId: subscription.id,
      destinationType: subscription.destinationType,
      status: 'pending',
      attemptNumber: 1,
      deliveryKey: buildInitialDeliveryKey(event.id, subscription.id),
      targetRef: getTargetRef(subscription.destinationType, subscription.destinationConfig),
    })),
    skipDuplicates: true,
  });

  const deliveries = await prisma.eventDelivery.findMany({
    where: {
      eventOutboxId: event.id,
      deliveryKey: {
        in: deliveryKeys,
      },
    },
    select: {
      id: true,
      subscriptionId: true,
      destinationType: true,
      deliveryKey: true,
    },
  });

  await prisma.eventOutbox.update({
    where: { id: event.id },
    data: {
      state: 'routed',
    },
  });

  await enqueueRoutedDeliveries(event.id, deliveries);

  return { matchedSubscriptions: subscriptions.length };
}
