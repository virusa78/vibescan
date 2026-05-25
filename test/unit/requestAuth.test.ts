import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import * as bcrypt from 'bcrypt';
import { resolveRequestUser, authenticateBearerApiKey } from '../../wasp-app/src/server/services/requestAuth';

jest.mock('bcrypt', () => ({
  compare: jest.fn() as any,
}));

const prismaMock = prisma as any;
const bcryptMock = bcrypt as any;

describe('requestAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.apiKey.findMany.mockReset();
    prismaMock.apiKey.update.mockReset();
    prismaMock.apiKeyUsageEvent = {
      create: (jest.fn() as any).mockResolvedValue({}),
    };
    prismaMock.user.findUnique.mockReset();
  });

  describe('resolveRequestUser', () => {
    it('returns context user when present', async () => {
      const user = { id: 'user-1', workspaceId: 'workspace-1' };
      const result = await resolveRequestUser({ headers: {} }, { user });
      expect(result).toEqual(user);
      expect(prismaMock.apiKey.findMany).not.toHaveBeenCalled();
    });

    it('returns request user when context user is not present but request.user is', async () => {
      const user = { id: 'user-2', workspaceId: 'workspace-2' };
      const result = await resolveRequestUser({ headers: {}, user }, {});
      expect(result).toEqual(user);
    });

    it('uses Authorization header case-insensitively and handles array header', async () => {
      const token = 'vsk_1234567890abcdef1234567890abcdef';
      prismaMock.apiKey.findMany.mockResolvedValue([]);
      
      const result = await resolveRequestUser(
        { headers: { Authorization: [`Bearer ${token}`] } },
        {}
      );

      expect(result).toBeNull();
      expect(prismaMock.apiKey.findMany).toHaveBeenCalled();
    });
  });

  describe('authenticateBearerApiKey', () => {
    it('returns null if authorization header is missing or does not start with Bearer', async () => {
      expect(await authenticateBearerApiKey(undefined)).toBeNull();
      expect(await authenticateBearerApiKey('Not-Bearer token')).toBeNull();
    });

    it('returns null if token is not a valid API key token format', async () => {
      expect(await authenticateBearerApiKey('Bearer short')).toBeNull();
    });

    it('skips expired keys', async () => {
      const token = 'vsk_1234567890abcdef1234567890abcdef';
      prismaMock.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-expired',
          keyHash: 'hashed',
          keyPrefix: 'vsk_12345678',
          enabled: true,
          expiresAt: new Date(Date.now() - 1000),
          user: { id: 'user-3', activeWorkspaceId: 'workspace-3' },
        },
      ]);

      const result = await authenticateBearerApiKey(`Bearer ${token}`);

      expect(result).toBeNull();
      expect(prismaMock.apiKey.update).not.toHaveBeenCalled();
    });

    it('returns null if bcrypt.compare does not match', async () => {
      const token = 'vsk_1234567890abcdef1234567890abcdef';
      prismaMock.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-active',
          keyHash: 'hashed',
          keyPrefix: 'vsk_12345678',
          enabled: true,
          expiresAt: new Date(Date.now() + 100000),
          user: { id: 'user-3', activeWorkspaceId: 'workspace-3' },
        },
      ]);
      bcryptMock.compare.mockResolvedValue(false);

      const result = await authenticateBearerApiKey(`Bearer ${token}`);

      expect(result).toBeNull();
      expect(bcryptMock.compare).toHaveBeenCalledWith(token, 'hashed');
    });

    it('authenticates legacy keys successfully, prioritizing candidate.workspaceId over activeWorkspaceId', async () => {
      const legacyToken = 'vsk_legacy_1234567890abcdef1234567890abcdef';
      
      // For legacy key prefixCandidates query is skipped and it queries keyPrefix: null candidates
      prismaMock.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-legacy',
          keyHash: 'hashed-legacy',
          keyPrefix: null,
          enabled: true,
          workspaceId: 'workspace-legacy-direct',
          user: { id: 'user-legacy', activeWorkspaceId: 'workspace-legacy-active' },
        },
      ]);
      bcryptMock.compare.mockResolvedValue(true);

      const result = await authenticateBearerApiKey(`Bearer ${legacyToken}`);

      expect(result).toEqual({
        id: 'user-legacy',
        workspaceId: 'workspace-legacy-direct',
      });
      expect(prismaMock.apiKey.update).toHaveBeenCalledWith({
        where: { id: 'key-legacy' },
        data: { lastUsedAt: expect.any(Date) },
      });
      expect(prismaMock.apiKeyUsageEvent.create).toHaveBeenCalledWith({
        data: { apiKeyId: 'key-legacy' },
      });
    });

    it('authenticates standard keys successfully, falling back to activeWorkspaceId', async () => {
      const token = 'vsk_1234567890abcdef1234567890abcdef';
      
      prismaMock.apiKey.findMany
        .mockResolvedValueOnce([
          {
            id: 'key-standard',
            keyHash: 'hashed-standard',
            keyPrefix: 'vsk_12345678',
            enabled: true,
            user: { id: 'user-std', activeWorkspaceId: 'workspace-std-active' },
          },
        ]);
      bcryptMock.compare.mockResolvedValue(true);

      const result = await authenticateBearerApiKey(`Bearer ${token}`);

      expect(result).toEqual({
        id: 'user-std',
        workspaceId: 'workspace-std-active',
      });
    });

    it('handles database write failure for apiKeyUsageEvent gracefully without throwing', async () => {
      const token = 'vsk_1234567890abcdef1234567890abcdef';
      
      prismaMock.apiKey.findMany.mockResolvedValue([
        {
          id: 'key-active',
          keyHash: 'hashed',
          keyPrefix: 'vsk_12345678',
          enabled: true,
          user: { id: 'user-3', activeWorkspaceId: 'workspace-3' },
        },
      ]);
      bcryptMock.compare.mockResolvedValue(true);
      
      // Force usage event log database call to throw
      prismaMock.apiKeyUsageEvent.create.mockRejectedValue(new Error('DB connection lost'));

      const result = await authenticateBearerApiKey(`Bearer ${token}`);

      // Authentication should still succeed even if recording usage fails
      expect(result).toEqual({
        id: 'user-3',
        workspaceId: 'workspace-3',
      });
    });
  });
});
