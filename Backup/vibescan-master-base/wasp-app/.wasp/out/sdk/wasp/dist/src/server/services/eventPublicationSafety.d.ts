import type { PublishCanonicalEventInput } from './eventPublisher.js';
export declare function publishAndRouteCanonicalEventSafely(input: PublishCanonicalEventInput, contextLabel: string): Promise<void>;
export declare function publishAndRouteCanonicalEventsSafely(inputs: PublishCanonicalEventInput[], contextLabel: string): Promise<void>;
//# sourceMappingURL=eventPublicationSafety.d.ts.map