import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const queueAddMock = jest.fn();

import { prisma } from '../mocks/wasp-server';
const prismaMock = prisma as any;

jest.mock('../../wasp-app/src/server/queues/config.js', () => ({
  webhookDeliveryQueue: {
    add: queueAddMock,
  },
}));

import { emitWebhookEvent } from '../../wasp-app/src/server/services/webhookEventEmitter';

describe('webhookEventEmitter.emitWebhookEvent', () => {
  beforeEach(() => {
    prismaMock.webhook = {
      findMany: jest.fn() as any,
    };
    prismaMock.webhookDelivery = {
      findMany: jest.fn() as any,
      create: jest.fn() as any,
    };
    queueAddMock.mockReset();
  });

  it('bulk-loads existing deliveries and skips duplicates without N+1 findFirst queries', async () => {
    prismaMock.webhook.findMany.mockResolvedValueOnce([
      { id: 'webhook-1', url: 'https://example.com/a', signingSecretEncrypted: 's1' },
      { id: 'webhook-2', url: 'https://example.com/b', signingSecretEncrypted: 's2' },
      { id: 'webhook-3', url: 'https://example.com/c', signingSecretEncrypted: 's3' },
    ]);
    prismaMock.webhookDelivery.findMany.mockResolvedValueOnce([
      { webhookId: 'webhook-2' },
    ]);
    prismaMock.webhookDelivery.create.mockImplementation(async ({ data }) => ({
      id: `delivery-${String(data.webhookId)}`,
    }));

    await emitWebhookEvent({
      scanId: 'scan-123',
      eventType: 'scan_complete',
      userId: 'user-1',
      payload: { status: 'done' },
      timestamp: new Date('2026-05-20T12:00:00.000Z'),
    });

    expect(prismaMock.webhookDelivery.findMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.webhookDelivery.findMany).toHaveBeenCalledWith({
      where: {
        webhookId: { in: ['webhook-1', 'webhook-2', 'webhook-3'] },
        scanId: 'scan-123',
        payloadHash: expect.any(String),
      },
      select: { webhookId: true },
    });
    expect(prismaMock.webhookDelivery.create).toHaveBeenCalledTimes(2);
    expect(queueAddMock).toHaveBeenCalledTimes(2);
    expect(queueAddMock.mock.calls.map(([name]) => name)).toEqual([
      'delivery-delivery-webhook-1',
      'delivery-delivery-webhook-3',
    ]);
  });
});
