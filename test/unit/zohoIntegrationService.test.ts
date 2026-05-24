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
});
