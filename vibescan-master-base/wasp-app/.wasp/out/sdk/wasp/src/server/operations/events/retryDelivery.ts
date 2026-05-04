import * as crypto from 'crypto';
import { HttpError } from 'wasp/server';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { eventDeliveryQueue } from '../../queues/config.js';

const retryEventDeliveryInputSchema = z.object({
  deliveryId: z.string().uuid(),
});

export async function retryEventDelivery(rawArgs: unknown, context: any): Promise<any> {
  const user = await requireWorkspaceScopedUser(context.user);
  const args = ensureArgsSchemaOrThrowHttpError(retryEventDeliveryInputSchema, rawArgs);

  const delivery = await context.entities.EventDelivery.findUnique({
    where: { id: args.deliveryId },
    include: {
      subscription: true,
    },
  });

  if (!delivery) {
    throw new HttpError(404, 'Event delivery not found');
  }

  const isOwned =
    delivery.subscription.workspaceId === user.workspaceId ||
    (!delivery.subscription.workspaceId && delivery.subscription.userId === user.id);

  if (!isOwned) {
    throw new HttpError(404, 'Event delivery not found');
  }

  const retried = await context.entities.EventDelivery.create({
    data: {
      eventOutboxId: delivery.eventOutboxId,
      subscriptionId: delivery.subscriptionId,
      destinationType: delivery.destinationType,
      status: 'pending',
      attemptNumber: 1,
      deliveryKey: `retry:${delivery.id}:${crypto.randomUUID()}`,
      targetRef: delivery.targetRef,
      manualRetryOfId: delivery.id,
    },
  });

  await eventDeliveryQueue.add(`event-delivery-${retried.id}`, {
    deliveryId: retried.id,
    eventOutboxId: retried.eventOutboxId,
    subscriptionId: retried.subscriptionId,
    destinationType: retried.destinationType,
    attemptNumber: 1,
  });

  return {
    id: retried.id,
    retried_from_id: delivery.id,
    status: retried.status,
  };
}
