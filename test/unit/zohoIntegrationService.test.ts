import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../mocks/wasp-server';
import { encryptSecret } from '../../wasp-app/src/server/utils/secretEncryption';

const queueAddMock = jest.fn() as any;
const fetchMock = jest.fn() as any;

jest.mock('wasp/server', () => ({
  prisma: (jest.requireActual('../mocks/wasp-server') as any).prisma,
  HttpError: class HttpError extends Error {
    statusCode: number;
    data?: Record<string, unknown>;

    constructor(statusCode: number, message: string, data?: Record<string, unknown>) {
      super(message);
      this.statusCode = statusCode;
      this.data = data;
    }
  },
}));

jest.mock('../../wasp-app/src/server/queues/zohoQueue.js', () => ({
  zohoSyncQueue: {
    add: queueAddMock,
  },
}));

const prismaMock = prisma as any;

function mockResponse(ok: boolean, status: number, body: unknown): any {
  return {
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('zoho integration service', () => {
  const originalEnv = {
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
    ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
    ZOHO_REDIRECT_URI: process.env.ZOHO_REDIRECT_URI,
    ZOHO_ACCOUNTS_BASE_URL: process.env.ZOHO_ACCOUNTS_BASE_URL,
    ZOHO_API_BASE_URL: process.env.ZOHO_API_BASE_URL,
  };

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 'zoho-integration-test-key').toString('hex').slice(0, 64);
    process.env.ZOHO_CLIENT_ID = 'client-id';
    process.env.ZOHO_CLIENT_SECRET = 'client-secret';
    process.env.ZOHO_REDIRECT_URI = 'https://app.example.com/zoho/callback';
    process.env.ZOHO_ACCOUNTS_BASE_URL = 'https://accounts.zoho.com';
    process.env.ZOHO_API_BASE_URL = 'https://www.zohoapis.com';

    queueAddMock.mockReset();
    fetchMock.mockReset();
    prismaMock.zohoIntegration.findUnique.mockReset();
    prismaMock.zohoIntegration.findMany.mockReset();
    prismaMock.zohoIntegration.upsert.mockReset();
    prismaMock.workspace.findUnique.mockReset();
    prismaMock.scan.findFirst.mockReset();
    prismaMock.scan.groupBy.mockReset();
    prismaMock.projectFinding.count.mockReset();

    prismaMock.workspace.findUnique.mockResolvedValue({
      id: 'workspace-1',
      name: 'Acme Security',
      slug: 'acme-security',
      isPersonal: false,
      createdByUser: {
        id: 'user-1',
        email: 'owner@acme.test',
        displayName: 'Ada Owner',
        username: 'ada',
        plan: 'pro',
        subscriptionStatus: 'active',
      },
    });
    prismaMock.scan.findFirst.mockResolvedValue({ completedAt: new Date('2026-05-24T10:00:00.000Z') });
    prismaMock.scan.groupBy.mockResolvedValue([
      { status: 'done', _count: { status: 3 } },
      { status: 'error', _count: { status: 1 } },
    ]);
    prismaMock.projectFinding.count.mockResolvedValue(2);

    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv.ENCRYPTION_KEY;
    process.env.ZOHO_CLIENT_ID = originalEnv.ZOHO_CLIENT_ID;
    process.env.ZOHO_CLIENT_SECRET = originalEnv.ZOHO_CLIENT_SECRET;
    process.env.ZOHO_REDIRECT_URI = originalEnv.ZOHO_REDIRECT_URI;
    process.env.ZOHO_ACCOUNTS_BASE_URL = originalEnv.ZOHO_ACCOUNTS_BASE_URL;
    process.env.ZOHO_API_BASE_URL = originalEnv.ZOHO_API_BASE_URL;
  });

  it('connects Zoho with an authorization code and queues an initial sync', async () => {
    fetchMock.mockResolvedValueOnce(
      mockResponse(true, 200, {
        access_token: 'access-token-1',
        refresh_token: 'refresh-token-1',
        expires_in: 3600,
        api_domain: 'https://www.zohoapis.com',
      }),
    );
    prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        syncStatus: 'queued',
        accountsDomain: 'https://accounts.zoho.com',
        apiDomain: 'https://www.zohoapis.com',
        zohoOrganizationId: null,
        zohoAccountId: null,
        zohoContactId: null,
        accessTokenEncrypted: encryptSecret('access-token-1'),
        refreshTokenEncrypted: encryptSecret('refresh-token-1'),
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
        syncCursor: null,
        syncState: {},
        lastSyncAt: null,
        lastSyncAttemptAt: new Date(),
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastPayloadHash: null,
      })
    prismaMock.zohoIntegration.upsert.mockResolvedValue({});
    queueAddMock.mockResolvedValue({ id: 'job-1' });

    const { connectZohoIntegrationForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
    const result = await connectZohoIntegrationForWorkspace({
      workspaceId: 'workspace-1',
      userId: 'user-1',
      authorizationCode: 'auth-code-123',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/oauth/v2/token'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(queueAddMock).toHaveBeenCalledWith(
      'zoho-sync-workspace-1-connect',
      expect.objectContaining({
        workspaceId: 'workspace-1',
        reason: 'connect',
      }),
      expect.objectContaining({
        jobId: 'zoho-sync:workspace-1',
      }),
    );
    expect(result.connected).toBe(true);
    expect(result.connection_status).toBe('connected');
  });

  it('upserts workspace summary records into Zoho Account and Contact modules', async () => {
    prismaMock.zohoIntegration.findUnique
      .mockResolvedValueOnce({
      id: 'integration-1',
      workspaceId: 'workspace-1',
      connectedByUserId: 'user-1',
      connectionStatus: 'connected',
      syncStatus: 'idle',
      accountsDomain: 'https://accounts.zoho.com',
      apiDomain: 'https://www.zohoapis.com',
      zohoOrganizationId: 'org-1',
      zohoAccountId: null,
      zohoContactId: null,
      accessTokenEncrypted: encryptSecret('access-token-1'),
      refreshTokenEncrypted: encryptSecret('refresh-token-1'),
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      syncCursor: null,
      syncState: {},
      lastSyncAt: null,
      lastSyncAttemptAt: null,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastPayloadHash: null,
    });
    prismaMock.zohoIntegration.upsert.mockResolvedValue({});
    fetchMock
      .mockResolvedValueOnce(mockResponse(true, 200, {
        data: [{ details: { id: 'account-1' }, code: 'SUCCESS', status: 'success' }],
      }))
      .mockResolvedValueOnce(mockResponse(true, 200, {
        data: [{ details: { id: 'contact-1' }, code: 'SUCCESS', status: 'success' }],
      }))
      .mockResolvedValueOnce(mockResponse(true, 200, {
        org: [{ id: 'org-1', company_name: 'Acme Security' }],
      }));

    const { processZohoWorkspaceSyncJob } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
    await processZohoWorkspaceSyncJob({
      workspaceId: 'workspace-1',
      reason: 'manual_resync',
      requestedByUserId: 'user-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(prismaMock.zohoIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'workspace-1' },
        update: expect.objectContaining({
          zohoAccountId: 'account-1',
          zohoContactId: 'contact-1',
          syncStatus: 'succeeded',
          connectionStatus: 'connected',
          lastPayloadHash: expect.any(String),
        }),
      }),
    );
  });

  it('revokes the stored refresh token and clears the integration state on disconnect', async () => {
    fetchMock.mockResolvedValueOnce(mockResponse(true, 200, { status: 'success' }));
    prismaMock.zohoIntegration.findUnique.mockResolvedValue({
      id: 'integration-1',
      workspaceId: 'workspace-1',
      connectedByUserId: 'user-1',
      connectionStatus: 'connected',
      syncStatus: 'succeeded',
      accountsDomain: 'https://accounts.zoho.com',
      apiDomain: 'https://www.zohoapis.com',
      zohoOrganizationId: 'org-1',
      zohoAccountId: 'account-1',
      zohoContactId: 'contact-1',
      accessTokenEncrypted: encryptSecret('access-token-1'),
      refreshTokenEncrypted: encryptSecret('refresh-token-1'),
      accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      syncCursor: '2026-05-24T10:00:00.000Z',
      syncState: {},
      lastSyncAt: new Date(),
      lastSyncAttemptAt: new Date(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastPayloadHash: 'hash',
      })
      .mockResolvedValueOnce({
        workspaceId: 'workspace-1',
        connectionStatus: 'disconnected',
        syncStatus: 'idle',
        accountsDomain: null,
        apiDomain: null,
        zohoOrganizationId: null,
        zohoAccountId: null,
        zohoContactId: null,
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
        syncCursor: null,
        syncState: {},
        lastSyncAt: null,
        lastSyncAttemptAt: null,
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
        lastPayloadHash: null,
      });
    prismaMock.zohoIntegration.upsert.mockResolvedValue({});

    const { disconnectZohoIntegrationForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
    const result = await disconnectZohoIntegrationForWorkspace({
      workspaceId: 'workspace-1',
      userId: 'user-1',
    });

    expect(prismaMock.zohoIntegration.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId: 'workspace-1' },
        update: expect.objectContaining({
          connectionStatus: 'disconnected',
          syncStatus: 'idle',
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          zohoAccountId: null,
          zohoContactId: null,
        }),
      }),
    );
  });

  describe('helper functions', () => {
    it('buildHumanName normalizes display names correctly', async () => {
      const { buildHumanName } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      expect(buildHumanName('')).toEqual({ firstName: null, lastName: 'VibeScan Workspace' });
      expect(buildHumanName(null)).toEqual({ firstName: null, lastName: 'VibeScan Workspace' });
      expect(buildHumanName('Ada')).toEqual({ firstName: null, lastName: 'Ada' });
      expect(buildHumanName('Ada Lovelace')).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
      expect(buildHumanName('Ada King Lovelace')).toEqual({ firstName: 'Ada King', lastName: 'Lovelace' });
    });

    it('safeJsonObject returns object or empty object', async () => {
      const { safeJsonObject } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      expect(safeJsonObject(null)).toEqual({});
      expect(safeJsonObject([])).toEqual({});
      expect(safeJsonObject({ a: 1 })).toEqual({ a: 1 });
    });

    it('formatErrorMessage formats errors correctly', async () => {
      const { formatErrorMessage } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      expect(formatErrorMessage('string error')).toBe('string error');
      expect(formatErrorMessage(new Error('error object'))).toBe('error object');
    });
  });

  describe('connect and token exchange edge cases', () => {
    it('throws 422 if Zoho OAuth env is not configured', async () => {
      delete process.env.ZOHO_CLIENT_ID;
      const { connectZohoIntegrationForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        connectZohoIntegrationForWorkspace({
          workspaceId: 'workspace-1',
          userId: 'user-1',
          authorizationCode: 'auth-code',
        })
      ).rejects.toThrow('Zoho OAuth env is not configured');
    });

    it('throws if authorizationCode or refreshToken is missing', async () => {
      const { connectZohoIntegrationForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        connectZohoIntegrationForWorkspace({
          workspaceId: 'workspace-1',
          userId: 'user-1',
        })
      ).rejects.toThrow('Zoho authorization code or refresh token is required');
    });

    it('throws if authorization code exchange fails', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(false, 400, { error: 'invalid_grant' }));
      const { connectZohoIntegrationForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        connectZohoIntegrationForWorkspace({
          workspaceId: 'workspace-1',
          userId: 'user-1',
          authorizationCode: 'auth-code',
        })
      ).rejects.toThrow('Zoho authorization code exchange failed');
    });

    it('throws if token refresh fails', async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(false, 400, { error: 'invalid_grant' }));
      const { connectZohoIntegrationForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        connectZohoIntegrationForWorkspace({
          workspaceId: 'workspace-1',
          userId: 'user-1',
          refreshToken: 'refresh-token',
        })
      ).rejects.toThrow('Zoho token refresh failed');
    });
  });

  describe('testZohoConnection', () => {
    it('throws if not connected', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue(null);
      const { testZohoConnectionForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        testZohoConnectionForWorkspace({ workspaceId: 'workspace-1' })
      ).rejects.toThrow('Zoho integration is not connected');
    });

    it('saves organization ID on successful test connection', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptSecret('access-token'),
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      });
      fetchMock.mockResolvedValueOnce(
        mockResponse(true, 200, {
          org: [{ id: 'org-99', company_name: 'Test Org' }],
        })
      );
      prismaMock.zohoIntegration.upsert.mockResolvedValue({});

      const { testZohoConnectionForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      const result = await testZohoConnectionForWorkspace({ workspaceId: 'workspace-1' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object)
      );
      expect(fetchMock.mock.calls[0][0].toString()).toContain('/crm/v8/org');
      expect(prismaMock.zohoIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            zohoOrganizationId: 'org-99',
            connectionStatus: 'connected',
          }),
        })
      );
    });

    it('attempts to refresh access token if expired', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptSecret('old-access-token'),
        refreshTokenEncrypted: encryptSecret('refresh-token'),
        accessTokenExpiresAt: new Date(Date.now() - 3600_000), // expired
      });
      fetchMock
        .mockResolvedValueOnce(
          mockResponse(true, 200, {
            access_token: 'new-access-token',
            expires_in: 3600,
          })
        )
        .mockResolvedValueOnce(
          mockResponse(true, 200, {
            org: [{ id: 'org-99', company_name: 'Test Org' }],
          })
        );
      prismaMock.zohoIntegration.upsert.mockResolvedValue({});

      const { testZohoConnectionForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await testZohoConnectionForWorkspace({ workspaceId: 'workspace-1' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object)
      );
      expect(fetchMock.mock.calls[0][0].toString()).toContain('/oauth/v2/token');
    });

    it('throws if expired and no refresh token exists', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        accessTokenEncrypted: null,
        refreshTokenEncrypted: null,
        accessTokenExpiresAt: null,
      });

      const { processZohoWorkspaceSyncJob } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        processZohoWorkspaceSyncJob({
          workspaceId: 'workspace-1',
          reason: 'manual_resync',
          requestedByUserId: 'user-1',
        })
      ).rejects.toThrow('Zoho access token is unavailable');
    });
  });

  describe('sync workspace and resync', () => {
    it('throws on manual resync if disconnected', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue(null);
      const { resyncZohoWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        resyncZohoWorkspace({ workspaceId: 'workspace-1', userId: 'user-1' })
      ).rejects.toThrow('Zoho integration is not connected');
    });

    it('returns immediately if payload hash matches and IDs exist', async () => {
      const snapshot = {
        workspace: { id: 'workspace-1', name: 'Acme Security', slug: 'acme-security', isPersonal: false },
        owner: { id: 'user-1', email: 'owner@acme.test', displayName: 'Ada Owner', username: 'ada' },
        summary: {
          plan: 'pro',
          billingState: 'active',
          scanHealth: 'degraded',
          lastScanAt: new Date('2026-05-24T10:00:00.000Z').toISOString(),
          openCriticalFindingsCount: 2,
          integrationHealth: 'connected',
        },
      };
      const summaryHash = require('crypto').createHash('sha256').update(JSON.stringify({
        snapshot,
        reason: 'manual_resync',
      })).digest('hex');

      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        zohoAccountId: 'account-1',
        zohoContactId: 'contact-1',
        lastPayloadHash: summaryHash,
      });

      const { processZohoWorkspaceSyncJob } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await processZohoWorkspaceSyncJob({
        workspaceId: 'workspace-1',
        reason: 'manual_resync',
        requestedByUserId: 'user-1',
      });

      // Fetch should not have been called because hash matches
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('handles HTTP error by saving sync error state', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        id: 'integration-1',
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptSecret('access-token'),
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      });
      fetchMock.mockResolvedValueOnce(mockResponse(false, 500, 'Server Crash'));

      const { processZohoWorkspaceSyncJob } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      await expect(
        processZohoWorkspaceSyncJob({
          workspaceId: 'workspace-1',
          reason: 'manual_resync',
          requestedByUserId: 'user-1',
        })
      ).rejects.toThrow('Zoho API request failed (500)');

      expect(prismaMock.zohoIntegration.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            connectionStatus: 'error',
            syncStatus: 'failed',
            lastErrorCode: 'http_500',
            lastErrorMessage: expect.stringContaining('Server Crash'),
          }),
        })
      );
    });
  });

  describe('reconciliation', () => {
    it('runs reconciliation and enqueues sync jobs', async () => {
      prismaMock.zohoIntegration.findMany.mockResolvedValue([
        { workspaceId: 'workspace-stale-1' },
        { workspaceId: 'workspace-stale-2' },
      ]);
      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-stale-1',
        syncState: {},
      });
      prismaMock.zohoIntegration.upsert.mockResolvedValue({});
      queueAddMock.mockResolvedValue({ id: 'job-recon' });

      const { reconcileZohoIntegrations } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      const count = await reconcileZohoIntegrations(new Date());

      expect(count).toBe(2);
      expect(queueAddMock).toHaveBeenCalledTimes(2);
    });

    it('starts and stops the reconciliation sweeper', async () => {
      const { startZohoReconciliationSweeper, stopZohoReconciliationSweeper } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      prismaMock.zohoIntegration.findMany.mockResolvedValue([]);
      
      startZohoReconciliationSweeper();
      await stopZohoReconciliationSweeper();
    });
  });

  describe('uncommon endpoints', () => {
    it('supports 204 status response in fetchZohoJson', async () => {
      prismaMock.zohoIntegration.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
        connectionStatus: 'connected',
        accessTokenEncrypted: encryptSecret('access-token'),
        accessTokenExpiresAt: new Date(Date.now() + 3600_000),
      });
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 204,
      });

      const { testZohoConnectionForWorkspace } = await import('../../wasp-app/src/server/services/zohoIntegrationService');
      const result = await testZohoConnectionForWorkspace({ workspaceId: 'workspace-1' });
      expect(result.connected).toBe(true);
    });
  });
});

