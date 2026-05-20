import { beforeEach, describe, expect, it } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import { getAPIKeyDetails } from '../../wasp-app/src/server/operations/apikeys/getAPIKeyDetails';

const prismaMock = prisma;

describe('getAPIKeyDetails', () => {
  beforeEach(() => {
    prismaMock.apiKey.findUnique.mockReset();
    prismaMock.apiKeyUsageEvent.count.mockReset();
    prismaMock.apiKeyUsageEvent.findMany.mockReset();
  });

  it('returns usage summary and status for the owner', async () => {
    prismaMock.apiKey.findUnique.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      name: 'CI key',
      createdAt: new Date('2026-04-01T10:00:00.000Z'),
      expiresAt: new Date(Date.now() + 86400000), // tomorrow
      lastUsedAt: new Date('2026-04-23T11:30:00.000Z'),
      enabled: true,
    });
    prismaMock.apiKeyUsageEvent.count.mockResolvedValueOnce(3);
    prismaMock.apiKeyUsageEvent.findMany.mockResolvedValueOnce([
      { createdAt: new Date('2026-04-23T09:00:00.000Z') },
      { createdAt: new Date('2026-04-23T09:30:00.000Z') },
      { createdAt: new Date('2026-04-22T18:00:00.000Z') },
    ]);

    const result = await getAPIKeyDetails(
      { keyId: '11111111-1111-4111-8111-111111111111' },
      { user: { id: '22222222-2222-4222-8222-222222222222' } }
    );

    expect(result.status).toEqual('active');
    expect(result.id).toEqual('11111111-1111-4111-8111-111111111111');
    expect(result.name).toEqual('CI key');
    expect(result.created_at).toEqual('2026-04-01T10:00:00.000Z');
    expect(result.last_used_at).toEqual('2026-04-23T11:30:00.000Z');
    expect(result.request_count).toEqual(3);
    expect(result.usage_by_day).toEqual([
      { date: '2026-04-22', count: 1 },
      { date: '2026-04-23', count: 2 },
    ]);
  });
});
