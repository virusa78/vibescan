import type { EventCategory, EventDestinationType } from '../../shared/events';
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
export declare function recoverStuckEventOutboxRecords(limit?: number): Promise<{
    recoveredCount: number;
}>;
export declare function getMatchingSubscriptions(event: RoutableEventRecord): Promise<MatchingSubscriptionRecord[]>;
export declare function routeEventOutboxRecord(eventOutboxId: string): Promise<{
    matchedSubscriptions: number;
}>;
export {};
//# sourceMappingURL=eventRouter.d.ts.map