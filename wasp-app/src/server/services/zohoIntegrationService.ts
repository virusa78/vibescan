import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { HttpError, prisma } from 'wasp/server';
import { encryptSecret, decryptSecret } from '../utils/secretEncryption.js';
import { getZohoAccountsBaseUrl, getZohoApiBaseUrl, getZohoClientId, getZohoClientSecret, getZohoRedirectUri, getZohoReconciliationIntervalMs, getZohoStaleSyncThresholdMs } from '../config/env.js';
import { zohoSyncQueue } from '../queues/zohoQueue.js';
import type { ZohoSyncJob } from '../queues/jobContract.js';

export type ZohoConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error';
export type ZohoSyncStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';

export type ZohoWorkspaceSnapshot = {
  workspace: {
    id: string;
    name: string;
    slug: string;
    isPersonal: boolean;
  };
  owner: {
    id: string;
    email: string;
    displayName: string | null;
    username: string | null;
  } | null;
  summary: {
    plan: string;
    billingState: string | null;
    scanHealth: 'idle' | 'healthy' | 'degraded' | 'processing';
    lastScanAt: string | null;
    openCriticalFindingsCount: number;
    integrationHealth: ZohoConnectionStatus;
  };
};

export type ZohoIntegrationStatus = {
  connected: boolean;
  connection_status: ZohoConnectionStatus;
  sync_status: ZohoSyncStatus;
  accounts_domain: string | null;
  api_domain: string | null;
  zoho_organization_id: string | null;
  zoho_account_id: string | null;
  zoho_contact_id: string | null;
  last_sync_at: string | null;
  last_sync_attempt_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  sync_cursor: string | null;
  last_payload_hash: string | null;
  workspace_snapshot: ZohoWorkspaceSnapshot | null;
};

type ZohoIntegrationRecord = {
  id: string;
  workspaceId: string;
  connectedByUserId: string | null;
  connectionStatus: 'disconnected' | 'connected' | 'syncing' | 'error';
  syncStatus: 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';
  accountsDomain: string | null;
  apiDomain: string | null;
  zohoOrganizationId: string | null;
  zohoAccountId: string | null;
  zohoContactId: string | null;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  accessTokenExpiresAt: Date | null;
  syncCursor: string | null;
  syncState: unknown;
  lastSyncAt: Date | null;
  lastSyncAttemptAt: Date | null;
  lastErrorAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastPayloadHash: string | null;
};

type ZohoAuthTokenResponse = {
  access_token: string;
  expires_in: number;
  api_domain?: string;
  refresh_token?: string;
  token_type?: string;
};

type ZohoOrgResponse = {
  org?: Array<{
    id: string;
    company_name?: string | null;
    domain_name?: string | null;
    primary_email?: string | null;
  }>;
};

type ZohoModuleMutationResponse = {
  data?: Array<{
    status?: string;
    code?: string;
    details?: {
      id?: string;
    };
    message?: string;
  }>;
};

type ZohoRecordPayload = Record<string, unknown>;

type ZohoWorkspaceReference = {
  workspaceId: string;
  userId?: string | null;
};

type SyncJobContext = {
  jobId?: string;
  attemptsMade?: number;
};

let reconciliationTimer: ReturnType<typeof setInterval> | null = null;
let reconciliationRunning = false;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function buildAccountsBaseUrl(): string {
  return normalizeBaseUrl(getZohoAccountsBaseUrl());
}

function buildApiBaseUrl(): string {
  return normalizeBaseUrl(getZohoApiBaseUrl());
}

function getClientCredentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const clientId = getZohoClientId();
  const clientSecret = getZohoClientSecret();
  const redirectUri = getZohoRedirectUri();

  if (!clientId || !clientSecret || !redirectUri) {
    throw new HttpError(
      422,
      'Zoho OAuth env is not configured',
      {
        missing_fields: [
          !clientId ? 'ZOHO_CLIENT_ID' : null,
          !clientSecret ? 'ZOHO_CLIENT_SECRET' : null,
          !redirectUri ? 'ZOHO_REDIRECT_URI' : null,
        ].filter(Boolean),
      },
    );
  }

  return { clientId, clientSecret, redirectUri };
}

function hashPayload(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function buildHumanName(value: string | null | undefined): { firstName: string | null; lastName: string } {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return { firstName: null, lastName: 'VibeScan Workspace' };
  }

  const pieces = trimmed.split(/\s+/).filter(Boolean);
  if (pieces.length === 1) {
    return { firstName: null, lastName: pieces[0] };
  }

  return {
    firstName: pieces.slice(0, -1).join(' '),
    lastName: pieces.at(-1) ?? pieces[0],
  };
}

export function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}


async function fetchZohoJson<T>(
  path: string,
  options: {
    accessToken?: string;
    accountsBaseUrl?: string;
    apiBaseUrl?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    query?: Record<string, string | number | boolean | null | undefined>;
  } = {},
): Promise<T> {
  const baseUrl = path.startsWith('/oauth/')
    ? (options.accountsBaseUrl ?? buildAccountsBaseUrl())
    : (options.apiBaseUrl ?? buildApiBaseUrl());
  const url = new URL(`${baseUrl}${path}`);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const response = await fetch(url, {
    method: options.method ?? (options.body ? 'POST' : 'GET'),
    headers: {
      Accept: 'application/json',
      ...(options.accessToken ? { Authorization: `Zoho-oauthtoken ${options.accessToken}` } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const error = new Error(`Zoho API request failed (${response.status}): ${bodyText}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

async function refreshAccessToken(refreshToken: string): Promise<ZohoAuthTokenResponse> {
  const { clientId, clientSecret } = getClientCredentials();
  const form = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch(`${buildAccountsBaseUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const error = new Error(`Zoho token refresh failed (${response.status}): ${bodyText}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  return response.json() as Promise<ZohoAuthTokenResponse>;
}

async function exchangeAuthorizationCode(authorizationCode: string): Promise<ZohoAuthTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getClientCredentials();
  const form = new URLSearchParams({
    code: authorizationCode,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch(`${buildAccountsBaseUrl()}/oauth/v2/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const error = new Error(`Zoho authorization code exchange failed (${response.status}): ${bodyText}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }

  return response.json() as Promise<ZohoAuthTokenResponse>;
}

async function revokeToken(token: string): Promise<void> {
  const url = new URL(`${buildAccountsBaseUrl()}/oauth/v2/token/revoke`);
  url.searchParams.set('token', token);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const bodyText = await response.text();
    const error = new Error(`Zoho token revoke failed (${response.status}): ${bodyText}`);
    (error as Error & { statusCode?: number }).statusCode = response.status;
    throw error;
  }
}

async function getWorkspaceSnapshot(workspaceId: string): Promise<ZohoWorkspaceSnapshot> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      id: true,
      name: true,
      slug: true,
      isPersonal: true,
      createdByUser: {
        select: {
          id: true,
          email: true,
          displayName: true,
          username: true,
          plan: true,
          subscriptionStatus: true,
        },
      },
    },
  });

  if (!workspace) {
    throw new HttpError(404, 'Workspace not found');
  }

  const [lastCompletedScan, activeFindingsCount, scanCounts] = await Promise.all([
    prisma.scan.findFirst({
      where: {
        workspaceId,
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.projectFinding.count({
      where: {
        workspaceId,
        severity: { in: ['CRITICAL'] },
        status: 'active',
      },
    }),
    prisma.scan.groupBy({
      by: ['status'],
      where: { workspaceId },
      _count: { status: true },
    }),
  ]);

  const totalScans = scanCounts.reduce((sum, row) => sum + row._count.status, 0);
  const pendingScans = scanCounts
    .filter((row) => row.status === 'pending' || row.status === 'scanning')
    .reduce((sum, row) => sum + row._count.status, 0);
  const failedScans = scanCounts
    .filter((row) => row.status === 'error')
    .reduce((sum, row) => sum + row._count.status, 0);

  const scanHealth: ZohoWorkspaceSnapshot['summary']['scanHealth'] = totalScans === 0
    ? 'idle'
    : pendingScans > 0
      ? 'processing'
      : failedScans > 0 || activeFindingsCount > 0
        ? 'degraded'
        : 'healthy';

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      isPersonal: workspace.isPersonal,
    },
    owner: workspace.createdByUser
      ? {
          id: workspace.createdByUser.id,
          email: workspace.createdByUser.email,
          displayName: workspace.createdByUser.displayName,
          username: workspace.createdByUser.username,
        }
      : null,
    summary: {
      plan: workspace.createdByUser.plan,
      billingState: workspace.createdByUser.subscriptionStatus,
      scanHealth,
      lastScanAt: lastCompletedScan?.completedAt?.toISOString() ?? null,
      openCriticalFindingsCount: activeFindingsCount,
      integrationHealth: 'connected',
    },
  };
}

function buildSummaryDescription(snapshot: ZohoWorkspaceSnapshot, integration: ZohoIntegrationStatus): string {
  return JSON.stringify({
    workspace: snapshot.workspace,
    owner: snapshot.owner,
    summary: {
      ...snapshot.summary,
      integrationHealth: integration.connection_status,
    },
    zoho: {
      connectionStatus: integration.connection_status,
      syncStatus: integration.sync_status,
      organizationId: integration.zoho_organization_id,
      accountId: integration.zoho_account_id,
      contactId: integration.zoho_contact_id,
      lastSyncAt: integration.last_sync_at,
    },
  });
}

function buildAccountPayload(snapshot: ZohoWorkspaceSnapshot, integration: ZohoIntegrationStatus): ZohoRecordPayload {
  return {
    Account_Name: snapshot.workspace.name,
    Description: buildSummaryDescription(snapshot, integration),
  };
}

function buildContactPayload(snapshot: ZohoWorkspaceSnapshot, integration: ZohoIntegrationStatus): ZohoRecordPayload {
  const humanName = buildHumanName(snapshot.owner?.displayName || snapshot.owner?.username || snapshot.owner?.email || snapshot.workspace.name);
  return {
    ...(humanName.firstName ? { First_Name: humanName.firstName } : {}),
    Last_Name: humanName.lastName,
    Email: snapshot.owner?.email ?? undefined,
    Description: buildSummaryDescription(snapshot, integration),
  };
}

async function createOrUpdateRecord(
  moduleApiName: 'Accounts' | 'Contacts',
  accessToken: string,
  recordId: string | null,
  payload: ZohoRecordPayload,
): Promise<string> {
  if (recordId) {
    const response = await fetchZohoJson<ZohoModuleMutationResponse>(
      `/crm/v8/${moduleApiName}/${recordId}`,
      {
        method: 'PUT',
        accessToken,
        body: { data: [{ id: recordId, ...payload }] },
      },
    );

    return response.data?.[0]?.details?.id ?? recordId;
  }

  const response = await fetchZohoJson<ZohoModuleMutationResponse>(
    `/crm/v8/${moduleApiName}`,
    {
      method: 'POST',
      accessToken,
      body: { data: [payload] },
    },
  );

  const createdId = response.data?.[0]?.details?.id;
  if (!createdId) {
    throw new Error(`Zoho ${moduleApiName} response did not include a record id`);
  }

  return createdId;
}

async function loadIntegration(workspaceId: string): Promise<ZohoIntegrationRecord | null> {
  return prisma.zohoIntegration.findUnique({
    where: { workspaceId },
  });
}

async function saveIntegration(
  workspaceId: string,
  data: Partial<ZohoIntegrationRecord>,
): Promise<void> {
  await prisma.zohoIntegration.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      connectionStatus: data.connectionStatus ?? 'disconnected',
      syncStatus: data.syncStatus ?? 'idle',
      syncState: (data.syncState ?? {}) as Prisma.InputJsonValue,
      accountsDomain: data.accountsDomain ?? null,
      apiDomain: data.apiDomain ?? null,
      zohoOrganizationId: data.zohoOrganizationId ?? null,
      zohoAccountId: data.zohoAccountId ?? null,
      zohoContactId: data.zohoContactId ?? null,
      accessTokenEncrypted: data.accessTokenEncrypted ?? null,
      refreshTokenEncrypted: data.refreshTokenEncrypted ?? null,
      accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
      syncCursor: data.syncCursor ?? null,
      lastSyncAt: data.lastSyncAt ?? null,
      lastSyncAttemptAt: data.lastSyncAttemptAt ?? null,
      lastErrorAt: data.lastErrorAt ?? null,
      lastErrorCode: data.lastErrorCode ?? null,
      lastErrorMessage: data.lastErrorMessage ?? null,
      lastPayloadHash: data.lastPayloadHash ?? null,
      connectedByUserId: data.connectedByUserId ?? null,
    },
    update: {
      ...(data.connectionStatus ? { connectionStatus: data.connectionStatus } : {}),
      ...(data.syncStatus ? { syncStatus: data.syncStatus } : {}),
      ...(data.syncState !== undefined ? { syncState: data.syncState as Prisma.InputJsonValue } : {}),
      ...(data.accountsDomain !== undefined ? { accountsDomain: data.accountsDomain } : {}),
      ...(data.apiDomain !== undefined ? { apiDomain: data.apiDomain } : {}),
      ...(data.zohoOrganizationId !== undefined ? { zohoOrganizationId: data.zohoOrganizationId } : {}),
      ...(data.zohoAccountId !== undefined ? { zohoAccountId: data.zohoAccountId } : {}),
      ...(data.zohoContactId !== undefined ? { zohoContactId: data.zohoContactId } : {}),
      ...(data.accessTokenEncrypted !== undefined ? { accessTokenEncrypted: data.accessTokenEncrypted } : {}),
      ...(data.refreshTokenEncrypted !== undefined ? { refreshTokenEncrypted: data.refreshTokenEncrypted } : {}),
      ...(data.accessTokenExpiresAt !== undefined ? { accessTokenExpiresAt: data.accessTokenExpiresAt } : {}),
      ...(data.syncCursor !== undefined ? { syncCursor: data.syncCursor } : {}),
      ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
      ...(data.lastSyncAttemptAt !== undefined ? { lastSyncAttemptAt: data.lastSyncAttemptAt } : {}),
      ...(data.lastErrorAt !== undefined ? { lastErrorAt: data.lastErrorAt } : {}),
      ...(data.lastErrorCode !== undefined ? { lastErrorCode: data.lastErrorCode } : {}),
      ...(data.lastErrorMessage !== undefined ? { lastErrorMessage: data.lastErrorMessage } : {}),
      ...(data.lastPayloadHash !== undefined ? { lastPayloadHash: data.lastPayloadHash } : {}),
      ...(data.connectedByUserId !== undefined ? { connectedByUserId: data.connectedByUserId } : {}),
    },
  });
}

async function setSyncError(
  workspaceId: string,
  error: unknown,
): Promise<void> {
  await saveIntegration(workspaceId, {
    connectionStatus: 'error',
    syncStatus: 'failed',
    lastErrorAt: new Date(),
    lastErrorCode: error instanceof Error && typeof (error as Error & { statusCode?: number }).statusCode === 'number'
      ? `http_${(error as Error & { statusCode?: number }).statusCode}`
      : 'sync_error',
    lastErrorMessage: formatErrorMessage(error).slice(0, 1_000),
  });
}

function buildStatusResponse(
  integration: ZohoIntegrationRecord | null,
  snapshot: ZohoWorkspaceSnapshot | null,
): ZohoIntegrationStatus {
  const statusAwareSnapshot = snapshot
    ? {
        ...snapshot,
        summary: {
          ...snapshot.summary,
          integrationHealth: integration?.connectionStatus ?? 'disconnected',
        },
      }
    : null;

  return {
    connected: integration?.connectionStatus === 'connected' || integration?.connectionStatus === 'syncing',
    connection_status: integration?.connectionStatus ?? 'disconnected',
    sync_status: integration?.syncStatus ?? 'idle',
    accounts_domain: integration?.accountsDomain ?? null,
    api_domain: integration?.apiDomain ?? null,
    zoho_organization_id: integration?.zohoOrganizationId ?? null,
    zoho_account_id: integration?.zohoAccountId ?? null,
    zoho_contact_id: integration?.zohoContactId ?? null,
    last_sync_at: integration?.lastSyncAt?.toISOString() ?? null,
    last_sync_attempt_at: integration?.lastSyncAttemptAt?.toISOString() ?? null,
    last_error_at: integration?.lastErrorAt?.toISOString() ?? null,
    last_error_code: integration?.lastErrorCode ?? null,
    last_error_message: integration?.lastErrorMessage ?? null,
    sync_cursor: integration?.syncCursor ?? null,
    last_payload_hash: integration?.lastPayloadHash ?? null,
    workspace_snapshot: statusAwareSnapshot,
  };
}

export async function getZohoIntegrationStatusForWorkspace(workspaceId: string): Promise<ZohoIntegrationStatus> {
  const [integration, snapshot] = await Promise.all([
    loadIntegration(workspaceId),
    getWorkspaceSnapshot(workspaceId).catch(() => null),
  ]);

  return buildStatusResponse(integration, snapshot);
}

export async function connectZohoIntegration(input: {
  workspaceId: string;
  userId: string;
  authorizationCode?: string | null;
  refreshToken?: string | null;
}): Promise<ZohoIntegrationStatus> {
  const tokenBundle = input.authorizationCode
    ? await exchangeAuthorizationCode(input.authorizationCode)
    : input.refreshToken
      ? await refreshAccessToken(input.refreshToken)
      : null;

  if (!tokenBundle?.access_token) {
    throw new HttpError(422, 'Zoho authorization code or refresh token is required');
  }

  const apiDomain = tokenBundle.api_domain ?? buildApiBaseUrl();
  const integration: ZohoIntegrationRecord = {
    id: '',
    workspaceId: input.workspaceId,
    connectedByUserId: input.userId,
    connectionStatus: 'connected',
    syncStatus: 'queued',
    accountsDomain: buildAccountsBaseUrl(),
    apiDomain,
    zohoOrganizationId: null,
    zohoAccountId: null,
    zohoContactId: null,
    accessTokenEncrypted: encryptSecret(tokenBundle.access_token),
    refreshTokenEncrypted: tokenBundle.refresh_token ? encryptSecret(tokenBundle.refresh_token) : input.refreshToken ? encryptSecret(input.refreshToken) : null,
    accessTokenExpiresAt: new Date(Date.now() + (tokenBundle.expires_in ?? 3600) * 1000),
    syncCursor: null,
    syncState: { connectedAt: new Date().toISOString(), source: input.authorizationCode ? 'authorization_code' : 'refresh_token' },
    lastSyncAt: null,
    lastSyncAttemptAt: new Date(),
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastPayloadHash: null,
  };

  await saveIntegration(input.workspaceId, integration);
  await enqueueZohoWorkspaceSync({
    workspaceId: input.workspaceId,
    reason: 'connect',
    requestedByUserId: input.userId,
  });

  return getZohoIntegrationStatusForWorkspace(input.workspaceId);
}

export async function disconnectZohoIntegration(input: ZohoWorkspaceReference): Promise<ZohoIntegrationStatus> {
  const integration = await loadIntegration(input.workspaceId);

  if (integration?.refreshTokenEncrypted) {
    try {
      await revokeToken(decryptSecret(integration.refreshTokenEncrypted));
    } catch (error) {
      console.warn('[Zoho] Token revoke failed during disconnect:', formatErrorMessage(error));
    }
  }

  await saveIntegration(input.workspaceId, {
    connectionStatus: 'disconnected',
    syncStatus: 'idle',
    connectedByUserId: null,
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

  return getZohoIntegrationStatusForWorkspace(input.workspaceId);
}

export async function testZohoConnection(input: ZohoWorkspaceReference): Promise<ZohoIntegrationStatus> {
  const integration = await loadIntegration(input.workspaceId);
  if (!integration?.accessTokenEncrypted) {
    throw new HttpError(422, 'Zoho integration is not connected');
  }

  const accessToken = await getValidZohoAccessToken(integration);
  const org = await fetchZohoJson<ZohoOrgResponse>('/crm/v8/org', {
    method: 'GET',
    accessToken,
    apiBaseUrl: integration.apiDomain ?? undefined,
  });

  await saveIntegration(input.workspaceId, {
    connectionStatus: 'connected',
    syncStatus: integration.syncStatus === 'running' ? 'running' : 'idle',
    zohoOrganizationId: org.org?.[0]?.id ?? integration.zohoOrganizationId,
    apiDomain: integration.apiDomain ?? buildApiBaseUrl(),
    accountsDomain: integration.accountsDomain ?? buildAccountsBaseUrl(),
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  });

  return getZohoIntegrationStatusForWorkspace(input.workspaceId);
}

async function getValidZohoAccessToken(integration: ZohoIntegrationRecord): Promise<string> {
  if (integration.accessTokenEncrypted && integration.accessTokenExpiresAt && integration.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
    return decryptSecret(integration.accessTokenEncrypted);
  }

  if (!integration.refreshTokenEncrypted) {
    if (integration.accessTokenEncrypted) {
      return decryptSecret(integration.accessTokenEncrypted);
    }
    throw new HttpError(422, 'Zoho access token is unavailable');
  }

  const refreshed = await refreshAccessToken(decryptSecret(integration.refreshTokenEncrypted));
  await saveIntegration(integration.workspaceId, {
    accessTokenEncrypted: encryptSecret(refreshed.access_token),
    accessTokenExpiresAt: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000),
    apiDomain: refreshed.api_domain ?? integration.apiDomain ?? buildApiBaseUrl(),
    connectionStatus: 'connected',
    syncStatus: integration.syncStatus === 'running' ? 'running' : 'idle',
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  });

  return refreshed.access_token;
}

async function syncWorkspaceToZoho(input: {
  workspaceId: string;
  reason: ZohoSyncJob['reason'];
  requestedByUserId?: string | null;
  jobId?: string;
  attemptsMade?: number;
}): Promise<ZohoIntegrationStatus> {
  const integration = await loadIntegration(input.workspaceId);
  if (!integration || integration.connectionStatus === 'disconnected') {
    throw new HttpError(422, 'Zoho integration is not connected');
  }

  const snapshot = await getWorkspaceSnapshot(input.workspaceId);
  const summaryHash = hashPayload({
    snapshot,
    reason: input.reason,
  });

  if (integration.lastPayloadHash === summaryHash && integration.zohoAccountId && integration.zohoContactId) {
    await saveIntegration(input.workspaceId, {
      connectionStatus: 'connected',
      syncStatus: 'succeeded',
      lastSyncAttemptAt: new Date(),
      lastSyncAt: new Date(),
      syncCursor: new Date().toISOString(),
      lastPayloadHash: summaryHash,
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
    });

    return getZohoIntegrationStatusForWorkspace(input.workspaceId);
  }

  await saveIntegration(input.workspaceId, {
    connectionStatus: 'syncing',
    syncStatus: 'running',
    lastSyncAttemptAt: new Date(),
    connectedByUserId: input.requestedByUserId ?? integration.connectedByUserId,
  });

  try {
    const accessToken = await getValidZohoAccessToken(integration);
    const currentStatus = await getZohoIntegrationStatusForWorkspace(input.workspaceId);
    const accountPayload = buildAccountPayload(snapshot, currentStatus);
    const contactPayload = buildContactPayload(snapshot, currentStatus);

    const accountId = await createOrUpdateRecord('Accounts', accessToken, integration.zohoAccountId, accountPayload);
    const contactId = await createOrUpdateRecord('Contacts', accessToken, integration.zohoContactId, contactPayload);

    const org = await fetchZohoJson<ZohoOrgResponse>('/crm/v8/org', {
      method: 'GET',
      accessToken,
      apiBaseUrl: integration.apiDomain ?? undefined,
    });

    await saveIntegration(input.workspaceId, {
      connectionStatus: 'connected',
      syncStatus: 'succeeded',
      zohoOrganizationId: org.org?.[0]?.id ?? integration.zohoOrganizationId,
      zohoAccountId: accountId,
      zohoContactId: contactId,
      accessTokenEncrypted: encryptSecret(accessToken),
      accessTokenExpiresAt: integration.accessTokenExpiresAt,
      apiDomain: integration.apiDomain ?? buildApiBaseUrl(),
      accountsDomain: integration.accountsDomain ?? buildAccountsBaseUrl(),
      syncCursor: new Date().toISOString(),
      syncState: {
        ...safeJsonObject(integration.syncState),
        lastReason: input.reason,
        lastJobId: input.jobId ?? null,
        lastAttemptsMade: input.attemptsMade ?? null,
        lastSnapshot: snapshot,
      },
      lastSyncAt: new Date(),
      lastErrorAt: null,
      lastErrorCode: null,
      lastErrorMessage: null,
      lastPayloadHash: summaryHash,
    });
  } catch (error) {
    await setSyncError(input.workspaceId, error);
    throw error;
  }

  return getZohoIntegrationStatusForWorkspace(input.workspaceId);
}

export async function enqueueZohoWorkspaceSync(input: ZohoSyncJob): Promise<{ queued: boolean; jobId: string }> {
  const job = await zohoSyncQueue.add(
    `zoho-sync-${input.workspaceId}-${input.reason}`,
    input,
    {
      jobId: `zoho-sync:${input.workspaceId}`,
      removeOnComplete: true,
      removeOnFail: false,
    },
  );

  await saveIntegration(input.workspaceId, {
    connectionStatus: 'connected',
    syncStatus: 'queued',
    lastSyncAttemptAt: new Date(),
    syncState: {
      ...(safeJsonObject((await loadIntegration(input.workspaceId))?.syncState)),
      lastEnqueuedReason: input.reason,
      lastQueuedJobId: String(job.id ?? ''),
    },
  });

  return { queued: true, jobId: String(job.id ?? '') };
}

export async function resyncZohoWorkspace(input: ZohoWorkspaceReference): Promise<{ queued: boolean; jobId: string; status: ZohoIntegrationStatus }> {
  const integration = await loadIntegration(input.workspaceId);
  if (!integration || integration.connectionStatus === 'disconnected') {
    throw new HttpError(422, 'Zoho integration is not connected');
  }

  const queued = await enqueueZohoWorkspaceSync({
    workspaceId: input.workspaceId,
    reason: 'manual_resync',
    requestedByUserId: input.userId ?? null,
  });

  return {
    queued: queued.queued,
    jobId: queued.jobId,
    status: await getZohoIntegrationStatusForWorkspace(input.workspaceId),
  };
}

export async function processZohoWorkspaceSyncJob(
  job: ZohoSyncJob,
  context: SyncJobContext = {},
): Promise<void> {
  await syncWorkspaceToZoho({
    workspaceId: job.workspaceId,
    reason: job.reason,
    requestedByUserId: job.requestedByUserId ?? null,
    jobId: context.jobId,
    attemptsMade: context.attemptsMade,
  });
}

export async function reconcileZohoIntegrations(now: Date = new Date()): Promise<number> {
  if (reconciliationRunning) {
    return 0;
  }

  reconciliationRunning = true;
  try {
    const staleThresholdMs = getZohoStaleSyncThresholdMs();
    const staleBefore = new Date(now.getTime() - staleThresholdMs);
    const integrations = await prisma.zohoIntegration.findMany({
      where: {
        connectionStatus: { in: ['connected', 'syncing', 'error'] },
        OR: [
          { lastSyncAt: { lt: staleBefore } },
          { lastSyncAt: null },
          { syncStatus: 'failed' },
        ],
      },
      select: {
        workspaceId: true,
      },
      take: 100,
    });

    let queuedCount = 0;
    for (const integration of integrations) {
      await enqueueZohoWorkspaceSync({
        workspaceId: integration.workspaceId,
        reason: 'reconciliation',
      });
      queuedCount += 1;
    }

    return queuedCount;
  } finally {
    reconciliationRunning = false;
  }
}

export function startZohoReconciliationSweeper(): void {
  if (reconciliationTimer) {
    return;
  }

  reconciliationTimer = setInterval(() => {
    void reconcileZohoIntegrations().catch((error) => {
      console.error('[Zoho] Reconciliation sweep failed:', error);
    });
  }, getZohoReconciliationIntervalMs());

  reconciliationTimer.unref?.();
  void reconcileZohoIntegrations().catch((error) => {
    console.error('[Zoho] Initial reconciliation sweep failed:', error);
  });
}

export async function stopZohoReconciliationSweeper(): Promise<void> {
  if (!reconciliationTimer) {
    return;
  }

  clearInterval(reconciliationTimer);
  reconciliationTimer = null;
}

export async function connectZohoIntegrationForWorkspace(input: {
  workspaceId: string;
  userId: string;
  authorizationCode?: string | null;
  refreshToken?: string | null;
}): Promise<ZohoIntegrationStatus> {
  return connectZohoIntegration(input);
}

export async function disconnectZohoIntegrationForWorkspace(input: ZohoWorkspaceReference): Promise<ZohoIntegrationStatus> {
  return disconnectZohoIntegration(input);
}

export async function testZohoConnectionForWorkspace(input: ZohoWorkspaceReference): Promise<ZohoIntegrationStatus> {
  return testZohoConnection(input);
}

export async function getZohoIntegrationStatusForWorkspaceInput(input: ZohoWorkspaceReference): Promise<ZohoIntegrationStatus> {
  return getZohoIntegrationStatusForWorkspace(input.workspaceId);
}
