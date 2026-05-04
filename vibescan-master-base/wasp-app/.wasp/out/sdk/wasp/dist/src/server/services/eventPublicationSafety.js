import { publishAndRouteCanonicalEvent, publishAndRouteCanonicalEvents, } from './eventPublisher.js';
function formatError(error) {
    return error instanceof Error ? error.stack || error.message : String(error);
}
export async function publishAndRouteCanonicalEventSafely(input, contextLabel) {
    try {
        await publishAndRouteCanonicalEvent(input);
    }
    catch (error) {
        console.error(`[${contextLabel}] Best-effort event publication failed: ${formatError(error)}`);
    }
}
export async function publishAndRouteCanonicalEventsSafely(inputs, contextLabel) {
    if (inputs.length === 0) {
        return;
    }
    try {
        await publishAndRouteCanonicalEvents(inputs);
    }
    catch (error) {
        console.error(`[${contextLabel}] Best-effort event publication failed: ${formatError(error)}`);
    }
}
//# sourceMappingURL=eventPublicationSafety.js.map