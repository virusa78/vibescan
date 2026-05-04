import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from 'wasp/server';
import { randomUUID } from 'crypto';
import { routeEventOutboxRecord } from './eventRouter.js';
import {
  buildCanonicalEvent,
  type CanonicalEvent,
  type CanonicalEventType,
  type EventCategory,
} from '../../shared/events';

export type PublishCanonicalEventInput = Omit<CanonicalEvent, 'id' | 'category'> & {
  id?: string;
  category?: EventCategory;
};

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function toInputJsonValue(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toEventOutboxRecord(event: CanonicalEvent) {
  return {
    id: event.id,
    occurredAt: new Date(event.occurredAt),
    eventType: event.type,
    category: event.category,
    version: event.version,
    source: event.source,
    workspaceId: event.workspaceId ?? null,
    userId: event.userId ?? null,
    entityType: event.entityType ?? null,
    entityId: event.entityId ?? null,
    traceId: event.traceId ?? null,
    correlationId: event.correlationId ?? null,
    payload: toInputJsonValue(event.payload),
    metadata: toInputJsonValue(event.metadata),
    payloadHash: hashJson({
      type: event.type,
      payload: event.payload,
      metadata: event.metadata,
    }),
    state: 'pending' as const,
  };
}

export async function publishCanonicalEvent(
  input: PublishCanonicalEventInput,
): Promise<CanonicalEvent> {
  const event = buildCanonicalEvent({
    ...input,
    id: input.id ?? randomUUID(),
  });

  await prisma.eventOutbox.create({
    data: toEventOutboxRecord(event),
  });

  return event;
}

export async function publishAndRouteCanonicalEvent(
  input: PublishCanonicalEventInput,
): Promise<CanonicalEvent> {
  const event = await publishCanonicalEvent(input);
  await routeEventOutboxRecord(event.id);
  return event;
}

export async function publishCanonicalEvents(
  inputs: PublishCanonicalEventInput[],
): Promise<CanonicalEvent[]> {
  const events = inputs.map((input) =>
    buildCanonicalEvent({
      ...input,
      id: input.id ?? randomUUID(),
    }),
  );

  if (events.length === 0) {
    return [];
  }

  await prisma.eventOutbox.createMany({
    data: events.map((event) => toEventOutboxRecord(event)),
  });

  return events;
}

export async function publishAndRouteCanonicalEvents(
  inputs: PublishCanonicalEventInput[],
): Promise<CanonicalEvent[]> {
  const events = await publishCanonicalEvents(inputs);

  for (const event of events) {
    await routeEventOutboxRecord(event.id);
  }

  return events;
}

export function buildEventSource(source: string, action: string): string {
  return `${source}.${action}`;
}

export function createCanonicalEventInput(
  type: CanonicalEventType,
  source: string,
  payload: Record<string, unknown>,
  extras: Partial<Omit<PublishCanonicalEventInput, 'type' | 'source' | 'payload' | 'version'>> = {},
): PublishCanonicalEventInput {
  return {
    type,
    source,
    version: '2026-05-03',
    occurredAt: new Date().toISOString(),
    payload,
    metadata: extras.metadata ?? {},
    workspaceId: extras.workspaceId ?? null,
    userId: extras.userId ?? null,
    entityType: extras.entityType ?? null,
    entityId: extras.entityId ?? null,
    traceId: extras.traceId ?? null,
    correlationId: extras.correlationId ?? null,
    category: extras.category,
  };
}
