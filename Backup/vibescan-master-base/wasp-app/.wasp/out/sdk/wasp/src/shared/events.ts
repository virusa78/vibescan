import * as z from 'zod';

export const EVENT_CATEGORIES = [
  'scanner_comparison',
  'customer',
  'billing',
  'quota',
  'scan',
  'report',
  'remediation',
  'vulnerability',
  'integration',
  'system',
] as const;

export const EVENT_DESTINATION_TYPES = [
  'zoho_crm',
  'generic_webhook',
  'observability_sink',
] as const;

export const EVENT_DELIVERY_STATUSES = [
  'pending',
  'delivered',
  'failed',
  'exhausted',
] as const;

export const EVENT_OUTBOX_STATES = [
  'pending',
  'routing',
  'routed',
  'completed',
  'failed',
] as const;

export const CANONICAL_EVENT_TYPES = [
  'customer.created',
  'customer.updated',
  'billing.customer.created',
  'billing.customer.updated',
  'billing.subscription.created',
  'billing.subscription.updated',
  'billing.subscription.deleted',
  'billing.invoice.paid',
  'billing.invoice.payment_failed',
  'quota.threshold_reached',
  'quota.exceeded',
  'quota.reset',
  'scan.submitted',
  'scan.started',
  'scan.completed',
  'scan.failed',
  'scan.cancelled',
  'report.generated',
  'scanner.comparison.completed',
  'scanner.delta.computed',
  'scanner.winner.updated',
  'vulnerability.detected',
  'vulnerability.threshold_exceeded',
  'remediation.requested',
  'remediation.generated',
  'remediation.failed',
  'remediation.quota_exceeded',
  'integration.connected',
  'integration.disconnected',
  'delivery.succeeded',
  'delivery.failed',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventDestinationType = (typeof EVENT_DESTINATION_TYPES)[number];
export type EventDeliveryStatus = (typeof EVENT_DELIVERY_STATUSES)[number];
export type EventOutboxState = (typeof EVENT_OUTBOX_STATES)[number];
export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];

export const eventCategorySchema = z.enum(EVENT_CATEGORIES);
export const eventDestinationTypeSchema = z.enum(EVENT_DESTINATION_TYPES);
export const eventDeliveryStatusSchema = z.enum(EVENT_DELIVERY_STATUSES);
export const eventOutboxStateSchema = z.enum(EVENT_OUTBOX_STATES);
export const canonicalEventTypeSchema = z.enum(CANONICAL_EVENT_TYPES);

export const canonicalEventRegistry = [
  { type: 'customer.created', category: 'customer' },
  { type: 'customer.updated', category: 'customer' },
  { type: 'billing.customer.created', category: 'billing' },
  { type: 'billing.customer.updated', category: 'billing' },
  { type: 'billing.subscription.created', category: 'billing' },
  { type: 'billing.subscription.updated', category: 'billing' },
  { type: 'billing.subscription.deleted', category: 'billing' },
  { type: 'billing.invoice.paid', category: 'billing' },
  { type: 'billing.invoice.payment_failed', category: 'billing' },
  { type: 'quota.threshold_reached', category: 'quota' },
  { type: 'quota.exceeded', category: 'quota' },
  { type: 'quota.reset', category: 'quota' },
  { type: 'scan.submitted', category: 'scan' },
  { type: 'scan.started', category: 'scan' },
  { type: 'scan.completed', category: 'scan' },
  { type: 'scan.failed', category: 'scan' },
  { type: 'scan.cancelled', category: 'scan' },
  { type: 'report.generated', category: 'report' },
  { type: 'scanner.comparison.completed', category: 'scanner_comparison' },
  { type: 'scanner.delta.computed', category: 'scanner_comparison' },
  { type: 'scanner.winner.updated', category: 'scanner_comparison' },
  { type: 'vulnerability.detected', category: 'vulnerability' },
  { type: 'vulnerability.threshold_exceeded', category: 'vulnerability' },
  { type: 'remediation.requested', category: 'remediation' },
  { type: 'remediation.generated', category: 'remediation' },
  { type: 'remediation.failed', category: 'remediation' },
  { type: 'remediation.quota_exceeded', category: 'remediation' },
  { type: 'integration.connected', category: 'integration' },
  { type: 'integration.disconnected', category: 'integration' },
  { type: 'delivery.succeeded', category: 'system' },
  { type: 'delivery.failed', category: 'system' },
] as const satisfies ReadonlyArray<{ type: CanonicalEventType; category: EventCategory }>;

export type CanonicalEventRegistryEntry = (typeof canonicalEventRegistry)[number];

const canonicalEventTypeToCategoryMap = new Map<CanonicalEventType, EventCategory>(
  canonicalEventRegistry.map((entry) => [entry.type, entry.category]),
);

export const canonicalEventMetadataSchema = z.record(z.string(), z.unknown()).default({});
export const canonicalEventPayloadSchema = z.record(z.string(), z.unknown());

export const canonicalEventSchema = z.object({
  id: z.string().uuid(),
  type: canonicalEventTypeSchema,
  category: eventCategorySchema,
  version: z.string().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  source: z.string().min(1),
  workspaceId: z.string().uuid().optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
  entityType: z.string().min(1).optional().nullable(),
  entityId: z.string().min(1).optional().nullable(),
  traceId: z.string().min(1).optional().nullable(),
  correlationId: z.string().min(1).optional().nullable(),
  payload: canonicalEventPayloadSchema,
  metadata: canonicalEventMetadataSchema,
});

export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;

export function isCanonicalEventType(value: string): value is CanonicalEventType {
  return (CANONICAL_EVENT_TYPES as readonly string[]).includes(value);
}

export function getCanonicalEventCategory(type: CanonicalEventType): EventCategory {
  const category = canonicalEventTypeToCategoryMap.get(type);
  if (!category) {
    throw new Error(`No category registered for canonical event type: ${type}`);
  }

  return category;
}

export function buildCanonicalEvent(input: Omit<CanonicalEvent, 'category'> & { category?: EventCategory }): CanonicalEvent {
  const category = input.category ?? getCanonicalEventCategory(input.type);
  return canonicalEventSchema.parse({
    ...input,
    category,
    metadata: input.metadata ?? {},
  });
}
