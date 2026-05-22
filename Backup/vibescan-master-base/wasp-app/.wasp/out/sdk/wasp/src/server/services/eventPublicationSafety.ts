import type { PublishCanonicalEventInput } from './eventPublisher.js';
import {
  publishAndRouteCanonicalEvent,
  publishAndRouteCanonicalEvents,
} from './eventPublisher.js';

function formatError(error: unknown): string {
  return error instanceof Error ? error.stack || error.message : String(error);
}

export async function publishAndRouteCanonicalEventSafely(
  input: PublishCanonicalEventInput,
  contextLabel: string,
): Promise<void> {
  try {
    await publishAndRouteCanonicalEvent(input);
  } catch (error) {
    console.error(`[${contextLabel}] Best-effort event publication failed: ${formatError(error)}`);
  }
}

export async function publishAndRouteCanonicalEventsSafely(
  inputs: PublishCanonicalEventInput[],
  contextLabel: string,
): Promise<void> {
  if (inputs.length === 0) {
    return;
  }

  try {
    await publishAndRouteCanonicalEvents(inputs);
  } catch (error) {
    console.error(`[${contextLabel}] Best-effort event publication failed: ${formatError(error)}`);
  }
}
