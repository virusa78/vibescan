import * as z from 'zod';
export declare const EVENT_CATEGORIES: readonly ["scanner_comparison", "customer", "billing", "quota", "scan", "report", "remediation", "vulnerability", "integration", "system"];
export declare const EVENT_DESTINATION_TYPES: readonly ["zoho_crm", "generic_webhook", "observability_sink"];
export declare const EVENT_DELIVERY_STATUSES: readonly ["pending", "delivered", "failed", "exhausted"];
export declare const EVENT_OUTBOX_STATES: readonly ["pending", "routing", "routed", "completed", "failed"];
export declare const CANONICAL_EVENT_TYPES: readonly ["customer.created", "customer.updated", "billing.customer.created", "billing.customer.updated", "billing.subscription.created", "billing.subscription.updated", "billing.subscription.deleted", "billing.invoice.paid", "billing.invoice.payment_failed", "quota.threshold_reached", "quota.exceeded", "quota.reset", "scan.submitted", "scan.started", "scan.completed", "scan.failed", "scan.cancelled", "report.generated", "scanner.comparison.completed", "scanner.delta.computed", "scanner.winner.updated", "vulnerability.detected", "vulnerability.threshold_exceeded", "remediation.requested", "remediation.generated", "remediation.failed", "remediation.quota_exceeded", "integration.connected", "integration.disconnected", "delivery.succeeded", "delivery.failed"];
export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventDestinationType = (typeof EVENT_DESTINATION_TYPES)[number];
export type EventDeliveryStatus = (typeof EVENT_DELIVERY_STATUSES)[number];
export type EventOutboxState = (typeof EVENT_OUTBOX_STATES)[number];
export type CanonicalEventType = (typeof CANONICAL_EVENT_TYPES)[number];
export declare const eventCategorySchema: z.ZodEnum<{
    scan: "scan";
    scanner_comparison: "scanner_comparison";
    customer: "customer";
    billing: "billing";
    quota: "quota";
    report: "report";
    remediation: "remediation";
    vulnerability: "vulnerability";
    integration: "integration";
    system: "system";
}>;
export declare const eventDestinationTypeSchema: z.ZodEnum<{
    zoho_crm: "zoho_crm";
    generic_webhook: "generic_webhook";
    observability_sink: "observability_sink";
}>;
export declare const eventDeliveryStatusSchema: z.ZodEnum<{
    pending: "pending";
    delivered: "delivered";
    failed: "failed";
    exhausted: "exhausted";
}>;
export declare const eventOutboxStateSchema: z.ZodEnum<{
    pending: "pending";
    completed: "completed";
    failed: "failed";
    routing: "routing";
    routed: "routed";
}>;
export declare const canonicalEventTypeSchema: z.ZodEnum<{
    "customer.created": "customer.created";
    "customer.updated": "customer.updated";
    "billing.customer.created": "billing.customer.created";
    "billing.customer.updated": "billing.customer.updated";
    "billing.subscription.created": "billing.subscription.created";
    "billing.subscription.updated": "billing.subscription.updated";
    "billing.subscription.deleted": "billing.subscription.deleted";
    "billing.invoice.paid": "billing.invoice.paid";
    "billing.invoice.payment_failed": "billing.invoice.payment_failed";
    "quota.threshold_reached": "quota.threshold_reached";
    "quota.exceeded": "quota.exceeded";
    "quota.reset": "quota.reset";
    "scan.submitted": "scan.submitted";
    "scan.started": "scan.started";
    "scan.completed": "scan.completed";
    "scan.failed": "scan.failed";
    "scan.cancelled": "scan.cancelled";
    "report.generated": "report.generated";
    "scanner.comparison.completed": "scanner.comparison.completed";
    "scanner.delta.computed": "scanner.delta.computed";
    "scanner.winner.updated": "scanner.winner.updated";
    "vulnerability.detected": "vulnerability.detected";
    "vulnerability.threshold_exceeded": "vulnerability.threshold_exceeded";
    "remediation.requested": "remediation.requested";
    "remediation.generated": "remediation.generated";
    "remediation.failed": "remediation.failed";
    "remediation.quota_exceeded": "remediation.quota_exceeded";
    "integration.connected": "integration.connected";
    "integration.disconnected": "integration.disconnected";
    "delivery.succeeded": "delivery.succeeded";
    "delivery.failed": "delivery.failed";
}>;
export declare const canonicalEventRegistry: readonly [{
    readonly type: "customer.created";
    readonly category: "customer";
}, {
    readonly type: "customer.updated";
    readonly category: "customer";
}, {
    readonly type: "billing.customer.created";
    readonly category: "billing";
}, {
    readonly type: "billing.customer.updated";
    readonly category: "billing";
}, {
    readonly type: "billing.subscription.created";
    readonly category: "billing";
}, {
    readonly type: "billing.subscription.updated";
    readonly category: "billing";
}, {
    readonly type: "billing.subscription.deleted";
    readonly category: "billing";
}, {
    readonly type: "billing.invoice.paid";
    readonly category: "billing";
}, {
    readonly type: "billing.invoice.payment_failed";
    readonly category: "billing";
}, {
    readonly type: "quota.threshold_reached";
    readonly category: "quota";
}, {
    readonly type: "quota.exceeded";
    readonly category: "quota";
}, {
    readonly type: "quota.reset";
    readonly category: "quota";
}, {
    readonly type: "scan.submitted";
    readonly category: "scan";
}, {
    readonly type: "scan.started";
    readonly category: "scan";
}, {
    readonly type: "scan.completed";
    readonly category: "scan";
}, {
    readonly type: "scan.failed";
    readonly category: "scan";
}, {
    readonly type: "scan.cancelled";
    readonly category: "scan";
}, {
    readonly type: "report.generated";
    readonly category: "report";
}, {
    readonly type: "scanner.comparison.completed";
    readonly category: "scanner_comparison";
}, {
    readonly type: "scanner.delta.computed";
    readonly category: "scanner_comparison";
}, {
    readonly type: "scanner.winner.updated";
    readonly category: "scanner_comparison";
}, {
    readonly type: "vulnerability.detected";
    readonly category: "vulnerability";
}, {
    readonly type: "vulnerability.threshold_exceeded";
    readonly category: "vulnerability";
}, {
    readonly type: "remediation.requested";
    readonly category: "remediation";
}, {
    readonly type: "remediation.generated";
    readonly category: "remediation";
}, {
    readonly type: "remediation.failed";
    readonly category: "remediation";
}, {
    readonly type: "remediation.quota_exceeded";
    readonly category: "remediation";
}, {
    readonly type: "integration.connected";
    readonly category: "integration";
}, {
    readonly type: "integration.disconnected";
    readonly category: "integration";
}, {
    readonly type: "delivery.succeeded";
    readonly category: "system";
}, {
    readonly type: "delivery.failed";
    readonly category: "system";
}];
export type CanonicalEventRegistryEntry = (typeof canonicalEventRegistry)[number];
export declare const canonicalEventMetadataSchema: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
export declare const canonicalEventPayloadSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export declare const canonicalEventSchema: z.ZodObject<{
    id: z.ZodString;
    type: z.ZodEnum<{
        "customer.created": "customer.created";
        "customer.updated": "customer.updated";
        "billing.customer.created": "billing.customer.created";
        "billing.customer.updated": "billing.customer.updated";
        "billing.subscription.created": "billing.subscription.created";
        "billing.subscription.updated": "billing.subscription.updated";
        "billing.subscription.deleted": "billing.subscription.deleted";
        "billing.invoice.paid": "billing.invoice.paid";
        "billing.invoice.payment_failed": "billing.invoice.payment_failed";
        "quota.threshold_reached": "quota.threshold_reached";
        "quota.exceeded": "quota.exceeded";
        "quota.reset": "quota.reset";
        "scan.submitted": "scan.submitted";
        "scan.started": "scan.started";
        "scan.completed": "scan.completed";
        "scan.failed": "scan.failed";
        "scan.cancelled": "scan.cancelled";
        "report.generated": "report.generated";
        "scanner.comparison.completed": "scanner.comparison.completed";
        "scanner.delta.computed": "scanner.delta.computed";
        "scanner.winner.updated": "scanner.winner.updated";
        "vulnerability.detected": "vulnerability.detected";
        "vulnerability.threshold_exceeded": "vulnerability.threshold_exceeded";
        "remediation.requested": "remediation.requested";
        "remediation.generated": "remediation.generated";
        "remediation.failed": "remediation.failed";
        "remediation.quota_exceeded": "remediation.quota_exceeded";
        "integration.connected": "integration.connected";
        "integration.disconnected": "integration.disconnected";
        "delivery.succeeded": "delivery.succeeded";
        "delivery.failed": "delivery.failed";
    }>;
    category: z.ZodEnum<{
        scan: "scan";
        scanner_comparison: "scanner_comparison";
        customer: "customer";
        billing: "billing";
        quota: "quota";
        report: "report";
        remediation: "remediation";
        vulnerability: "vulnerability";
        integration: "integration";
        system: "system";
    }>;
    version: z.ZodString;
    occurredAt: z.ZodString;
    source: z.ZodString;
    workspaceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    userId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    entityType: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    entityId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    traceId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    correlationId: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.core.$strip>;
export type CanonicalEvent = z.infer<typeof canonicalEventSchema>;
export declare function isCanonicalEventType(value: string): value is CanonicalEventType;
export declare function getCanonicalEventCategory(type: CanonicalEventType): EventCategory;
export declare function buildCanonicalEvent(input: Omit<CanonicalEvent, 'category'> & {
    category?: EventCategory;
}): CanonicalEvent;
//# sourceMappingURL=events.d.ts.map