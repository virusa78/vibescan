import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as bcrypt from 'bcrypt';
import { generateApiKeyPrefix } from '../../wasp-app/src/shared/apiKey';
import { prisma } from '../mocks/wasp-server';
import { resolveRequestUser } from '../../wasp-app/src/server/services/requestAuth';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

const prismaMock = prisma;
const compareMock = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

describe('resolveRequestUser', () => {
  beforeEach(() => {
    prismaMock.apiKey.findMany.mockReset();
    prismaMock.apiKey.update.mockReset();
    compareMock.mockReset();
  });

  it('returns context user when present', async () => {
    const user = { id: 'user-1' };

    const result = await resolveRequestUser({ headers: {} }, { user });

    expect(result).toEqual(user);
    expect(prismaMock.apiKey.findMany).not.toHaveBeenCalled();
  });

  it('skips expired keys', async () => {
    const token = 'vsk_1234567890abcdef';
    const prefix = generateApiKeyPrefix(token);

    prismaMock.apiKey.findMany.mockImplementationOnce(async () => [
      {
        id: 'key-expired',
        keyHash: 'hashed',
        keyPrefix: prefix,
        enabled: true,
        expiresAt: new Date(Date.now() - 1000),
        user: { id: 'user-3' },
      },
    ]);
    compareMock.mockImplementationOnce(async () => true);

    const result = await resolveRequestUser(
      { headers: { authorization: `Bearer ${token}` } },
      {}
    );

    expect(result).toBeNull();
    expect(prismaMock.apiKey.update).not.toHaveBeenCalled();
  });
});
