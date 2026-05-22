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
export declare function buildEventDeliveryRequest(event: CanonicalEventLike, subscription: DeliverySubscriptionLike): DeliveryRequest;
export {};
//# sourceMappingURL=eventDestinationService.d.ts.map