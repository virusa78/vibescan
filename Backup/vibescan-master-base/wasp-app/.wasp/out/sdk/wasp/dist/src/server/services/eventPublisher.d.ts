import { type CanonicalEvent, type CanonicalEventType, type EventCategory } from '../../shared/events';
export type PublishCanonicalEventInput = Omit<CanonicalEvent, 'id' | 'category'> & {
    id?: string;
    category?: EventCategory;
};
export declare function publishCanonicalEvent(input: PublishCanonicalEventInput): Promise<CanonicalEvent>;
export declare function publishAndRouteCanonicalEvent(input: PublishCanonicalEventInput): Promise<CanonicalEvent>;
export declare function publishCanonicalEvents(inputs: PublishCanonicalEventInput[]): Promise<CanonicalEvent[]>;
export declare function publishAndRouteCanonicalEvents(inputs: PublishCanonicalEventInput[]): Promise<CanonicalEvent[]>;
export declare function buildEventSource(source: string, action: string): string;
export declare function createCanonicalEventInput(type: CanonicalEventType, source: string, payload: Record<string, unknown>, extras?: Partial<Omit<PublishCanonicalEventInput, 'type' | 'source' | 'payload' | 'version'>>): PublishCanonicalEventInput;
//# sourceMappingURL=eventPublisher.d.ts.map