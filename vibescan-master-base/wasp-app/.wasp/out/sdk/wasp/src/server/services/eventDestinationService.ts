import type { EventDestinationType } from '../../shared/events';

type CanonicalEventLike = {
  id: string;
  eventType: string;
  category: string;
  version: string;
  occurredAt: Date;
  source: string;
  workspaceId?: string | null;
  userId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  traceId?: string | null;
  correlationId?: string | null;
  payload: unknown;
  metadata: unknown;
};

type DeliverySubscriptionLike = {
  destinationType: EventDestinationType;
  destinationConfig: unknown;
};

type DeliveryRequest = {
  url: string;
  headers: Record<string, string>;
  body: string;
};

const ZOHO_ALLOWED_EVENT_TYPES = new Set([
  'customer.created',
  'customer.updated',
  'billing.customer.created',
  'billing.customer.updated',
  'billing.subscription.created',
  'billing.subscription.updated',
  'billing.subscription.deleted',
  'billing.invoice.paid',
  'billing.invoice.payment_failed',
  'quota.exceeded',
]);

function assertObjectConfig(destinationConfig: unknown): Record<string, unknown> {
  if (!destinationConfig || typeof destinationConfig !== 'object') {
    throw new Error('Missing destination config');
  }

  return destinationConfig as Record<string, unknown>;
}

function getRequiredUrl(destinationConfig: Record<string, unknown>): string {
  const value = destinationConfig.url ?? destinationConfig.webhookUrl;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Destination requires url');
  }

  return value;
}

function buildCanonicalEnvelope(event: CanonicalEventLike) {
  return {
    id: event.id,
    type: event.eventType,
    category: event.category,
    version: event.version,
    occurredAt: event.occurredAt.toISOString(),
    source: event.source,
    workspaceId: event.workspaceId ?? null,
    userId: event.userId ?? null,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    traceId: event.traceId ?? null,
    correlationId: event.correlationId ?? null,
    payload: event.payload,
    metadata: event.metadata,
  };
}

function buildZohoProjection(
  event: CanonicalEventLike,
  destinationConfig: Record<string, unknown>,
) {
  if (!ZOHO_ALLOWED_EVENT_TYPES.has(event.eventType)) {
    throw new Error(`Zoho destination does not allow event type ${event.eventType}`);
  }

  return {
    event_id: event.id,
    event_type: event.eventType,
    occurred_at: event.occurredAt.toISOString(),
    source: event.source,
    account_ref:
      typeof destinationConfig.accountRef === 'string' && destinationConfig.accountRef.length > 0
        ? destinationConfig.accountRef
        : null,
    workspace_id: event.workspaceId ?? null,
    user_id: event.userId ?? null,
    entity_type: event.entityType ?? null,
    entity_id: event.entityId ?? null,
    payload: event.payload,
  };
}

export function buildEventDeliveryRequest(
  event: CanonicalEventLike,
  subscription: DeliverySubscriptionLike,
): DeliveryRequest {
  const destinationConfig = assertObjectConfig(subscription.destinationConfig);
  const url = getRequiredUrl(destinationConfig);

  if (subscription.destinationType === 'zoho_crm') {
    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Vibescan-Destination': 'zoho_crm',
        'X-Vibescan-Event': event.eventType,
        'X-Vibescan-Event-Id': event.id,
      },
      body: JSON.stringify(buildZohoProjection(event, destinationConfig)),
    };
  }

  if (subscription.destinationType === 'observability_sink') {
    return {
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-Vibescan-Destination': 'observability_sink',
        'X-Vibescan-Event': event.eventType,
        'X-Vibescan-Event-Id': event.id,
      },
      body: JSON.stringify({
        ...buildCanonicalEnvelope(event),
        observability: true,
      }),
    };
  }

  return {
    url,
    headers: {
      'Content-Type': 'application/json',
      'X-Vibescan-Destination': 'generic_webhook',
      'X-Vibescan-Event': event.eventType,
      'X-Vibescan-Event-Id': event.id,
    },
    body: JSON.stringify(buildCanonicalEnvelope(event)),
  };
}
