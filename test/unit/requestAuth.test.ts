import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import { resolveRequestUser } from '../../wasp-app/src/server/services/requestAuth';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const prismaMock = prisma;
describe('resolveRequestUser', () => {
  beforeEach(() => {
    prismaMock.apiKey.findMany.mockReset();
    prismaMock.apiKey.update.mockReset();
    prismaMock.apiKeyUsageEvent.create.mockReset();
  });

  it('returns context user when present', async () => {
    const user = { id: 'user-1' };

    const result = await resolveRequestUser({ headers: {} }, { user });

    expect(result).toEqual(user);
    expect(prismaMock.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('skips expired keys', async () => {
    const token = 'vsk_1234567890abcdef1234567890abcdef';

    prismaMock.apiKey.findMany.mockImplementationOnce(async () => [
      {
        id: 'key-expired',
        keyHash: 'hashed',
        keyPrefix: 'vsk_12345678',
        enabled: true,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-3' },
      },
    ]);

    const result = await resolveRequestUser(
      { headers: { authorization: `Bearer ${token}` } },
      {}
    );

    expect(result).toBeNull();
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled();
    expect(prismaMock.apiKeyUsageEvent.create).not.toHaveBeenCalled();
  });

});
