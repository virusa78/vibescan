// HubSpot CRM integration service - handles OAuth, sync, and webhook logic
import { createHash } from 'node:crypto';
import { HttpError, prisma } from 'wasp/server';
import { encryptSecret, decryptSecret } from '../utils/secretEncryption.js';
import {
  getHubspotClientId,
  getHubspotClientSecret,
  getHubspotRedirectUri,
  getHubspotServiceKey,
} from '../config/env.js';
import { hubspotSyncQueue } from '../queues/hubspotQueue.js';
import type { HubspotSyncJob } from '../queues/jobContract.js';

export type HubspotConnectionStatus = 'disconnected' | 'connected' | 'syncing' | 'error';
export type HubspotSyncStatus = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';

export type HubspotWorkspaceSnapshot = {
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
    integrationHealth: HubspotConnectionStatus;
  };
};

export type HubspotIntegrationStatus = {
  connected: boolean;
  connection_status: HubspotConnectionStatus;
  sync_status: HubspotSyncStatus;
  hubspot_portal_id: string | null;
  hubspot_app_id: string | null;
  last_sync_at: string | null;
  last_sync_attempt_at: string | null;
  last_error_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  last_payload_hash: string | null;
};

/**
 * Get HubSpot integration status for a workspace
 */
export async function getHubspotStatus(workspaceId: string): Promise<HubspotIntegrationStatus> {
  const serviceKey = process.env.NODE_ENV !== 'test' ? getHubspotServiceKey() : null;
  const crmIntegration = await prisma.crmIntegration.findUnique({
    where: { workspaceId },
  });

  if (serviceKey) {
    return {
      connected: true,
      connection_status: (crmIntegration?.connectionStatus as HubspotConnectionStatus) || 'connected',
      sync_status: (crmIntegration?.syncStatus as HubspotSyncStatus) || 'idle',
      hubspot_portal_id: (crmIntegration?.metadata as Record<string, any>)?.hubspot_portal_id || 'service-key',
      hubspot_app_id: (crmIntegration?.metadata as Record<string, any>)?.hubspot_app_id || 'service-key',
      last_sync_at: crmIntegration?.lastSyncAt?.toISOString() || null,
      last_sync_attempt_at: crmIntegration?.lastSyncAttemptAt?.toISOString() || null,
      last_error_at: crmIntegration?.lastErrorAt?.toISOString() || null,
      last_error_code: crmIntegration?.lastErrorCode || null,
      last_error_message: crmIntegration?.lastErrorMessage || null,
      last_payload_hash: crmIntegration?.lastPayloadHash || null,
    };
  }

  if (!crmIntegration || crmIntegration.provider !== 'hubspot') {
    return {
      connected: false,
      connection_status: 'disconnected',
      sync_status: 'idle',
      hubspot_portal_id: null,
      hubspot_app_id: null,
      last_sync_at: null,
      last_sync_attempt_at: null,
      last_error_at: null,
      last_error_code: null,
      last_error_message: null,
      last_payload_hash: null,
    };
  }

  const metadata = crmIntegration.metadata as Record<string, any>;
  const portalId = (metadata?.hubspot_portal_id as string) || null;
  const appId = (metadata?.hubspot_app_id as string) || null;

  return {
    connected: !!crmIntegration.accessToken,
    connection_status: crmIntegration.connectionStatus as HubspotConnectionStatus,
    sync_status: crmIntegration.syncStatus as HubspotSyncStatus,
    hubspot_portal_id: portalId,
    hubspot_app_id: appId,
    last_sync_at: crmIntegration.lastSyncAt?.toISOString() || null,
    last_sync_attempt_at: crmIntegration.lastSyncAttemptAt?.toISOString() || null,
    last_error_at: crmIntegration.lastErrorAt?.toISOString() || null,
    last_error_code: crmIntegration.lastErrorCode || null,
    last_error_message: crmIntegration.lastErrorMessage || null,
    last_payload_hash: crmIntegration.lastPayloadHash || null,
  };
}

/**
 * Generate HubSpot OAuth authorization URL
 */
export function getHubspotAuthUrl(): string {
  const state = createHash('sha256').update(Date.now().toString()).digest('hex');
  const scopes = [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.objects.deals.read',
    'crm.objects.deals.write',
  ].join('+');

  const url = new URL('https://app.hubapi.com/oauth/authorize');
  url.searchParams.set('client_id', getHubspotClientId());
  url.searchParams.set('scope', scopes);
  url.searchParams.set('redirect_uri', getHubspotRedirectUri());
  url.searchParams.set('state', state);

  return url.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeHubspotCode(
  code: string,
  _workspaceId: string,
  _userId: string,
): Promise<{ accessToken: string; portalId: string }> {
  const tokenUrl = 'https://api.hubapi.com/oauth/v1/token';

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: getHubspotClientId(),
      client_secret: getHubspotClientSecret(),
      redirect_uri: getHubspotRedirectUri(),
      code,
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new HttpError(400, 'hubspot_auth_failed', {
      message: `HubSpot OAuth failed: ${error}`,
    });
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  const accessToken = data.access_token;

  // Fetch portal info
  const portalRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?limit=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!portalRes.ok) {
    throw new HttpError(400, 'hubspot_portal_fetch_failed', {
      message: 'Failed to fetch HubSpot portal info',
    });
  }

  // For now, use a placeholder portal ID; in production, extract from API response
  const portalId = 'hubspot-' + createHash('sha1').update(accessToken).digest('hex').slice(0, 8);

  return { accessToken, portalId };
}

/**
 * Store HubSpot connection in database
 */
export async function storeHubspotConnection(
  workspaceId: string,
  userId: string,
  accessToken: string,
  portalId: string,
): Promise<void> {
  const encryptedToken = encryptSecret(accessToken);

  await prisma.crmIntegration.upsert({
    where: { workspaceId },
    update: {
      provider: 'hubspot',
      accessToken: encryptedToken,
      connectionStatus: 'connected',
      syncStatus: 'idle',
      metadata: { hubspot_portal_id: portalId },
      lastSyncAt: new Date(),
    },
    create: {
      workspaceId,
      provider: 'hubspot',
      accessToken: encryptedToken,
      connectionStatus: 'connected',
      syncStatus: 'idle',
      metadata: { hubspot_portal_id: portalId },
      lastSyncAt: new Date(),
    },
  });
}

/**
 * Disconnect HubSpot integration
 */
export async function disconnectHubspot(workspaceId: string): Promise<void> {
  await prisma.crmIntegration.update({
    where: { workspaceId },
    data: {
      accessToken: null,
      connectionStatus: 'disconnected',
      syncStatus: 'idle',
    },
  });
}

/**
 * Get decrypted HubSpot access token
 */
export async function getHubspotAccessToken(workspaceId: string): Promise<string | null> {
  const serviceKey = process.env.NODE_ENV !== 'test' ? getHubspotServiceKey() : null;
  if (serviceKey) {
    return serviceKey;
  }

  const crmIntegration = await prisma.crmIntegration.findUnique({
    where: { workspaceId },
  });

  if (!crmIntegration?.accessToken || crmIntegration.provider !== 'hubspot') {
    return null;
  }

  return decryptSecret(crmIntegration.accessToken);
}

/**
 * Queue a HubSpot sync job
 */
export async function queueHubspotSync(workspaceId: string, payload: Omit<HubspotSyncJob['data'], 'workspaceId'>): Promise<void> {
  await hubspotSyncQueue.add('hubspot-sync', { workspaceId, ...payload });
}

/**
 * Record sync error
 */
export async function recordHubspotSyncError(
  workspaceId: string,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await prisma.crmIntegration.update({
    where: { workspaceId },
    data: {
      syncStatus: 'failed',
      lastErrorAt: new Date(),
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
      connectionStatus: errorCode === 'auth_failed' ? 'error' : 'connected',
    },
  });
}

/**
 * Process HubSpot workspace sync job (main sync logic)
 */
export async function processHubspotWorkspaceSyncJob(
  data: HubspotSyncJob['data'],
  _context: { jobId?: string; attemptsMade: number },
): Promise<void> {
  const { workspaceId, trigger, userId, force } = data;

  try {
    const serviceKey = process.env.NODE_ENV !== 'test' ? getHubspotServiceKey() : null;
    let crmIntegration = await prisma.crmIntegration.findUnique({
      where: { workspaceId },
    });

    if (!crmIntegration && serviceKey) {
      crmIntegration = await prisma.crmIntegration.create({
        data: {
          workspaceId,
          provider: 'hubspot',
          connectionStatus: 'connected',
          syncStatus: 'idle',
        },
      });
    }

    if (crmIntegration && crmIntegration.provider !== 'hubspot') {
      return;
    }

    // Update sync status
    await prisma.crmIntegration.update({
      where: { workspaceId },
      data: {
        syncStatus: 'running',
        lastSyncAttemptAt: new Date(),
      },
    });

    // Fetch access token
    const accessToken = serviceKey
      ? serviceKey
      : (crmIntegration?.accessToken && crmIntegration.provider === 'hubspot'
        ? decryptSecret(crmIntegration.accessToken)
        : null);
    if (!accessToken) {
      await recordHubspotSyncError(workspaceId, 'not_connected', 'HubSpot is not connected');
      return;
    }

    // Fetch workspace data
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { createdByUser: true },
    });

    if (!workspace) {
      await recordHubspotSyncError(workspaceId, 'workspace_not_found', 'Workspace not found');
      return;
    }

    // Create contact snapshot
    const contactSnapshot = {
      email: workspace.createdByUser?.email || 'unknown@example.com',
      firstname: workspace.createdByUser?.displayName?.split(' ')[0] || 'Unknown',
      lastname: workspace.createdByUser?.displayName?.split(' ').slice(1).join(' ') || 'User',
      phone: '',
      company: workspace.name,
      website: '',
    };

    const payload = JSON.stringify(contactSnapshot);
    const payloadHash = createHash('sha256').update(payload).digest('hex');

    // Skip if payload hasn't changed (unless force=true)
    crmIntegration = await prisma.crmIntegration.findUnique({
      where: { workspaceId },
    });

    if (!force && crmIntegration?.lastPayloadHash === payloadHash) {
      // No change, mark as succeeded
      await prisma.crmIntegration.update({
        where: { workspaceId },
        data: {
          syncStatus: 'succeeded',
          lastSyncAt: new Date(),
        },
      });
      return;
    }

    // Create or update contact in HubSpot
    const hsContactRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: contactSnapshot,
      }),
    });

    if (hsContactRes.status === 401) {
      await recordHubspotSyncError(workspaceId, 'auth_failed', 'HubSpot token expired');
      return;
    }

    if (!hsContactRes.ok) {
      const error = await hsContactRes.text();
      await recordHubspotSyncError(workspaceId, 'sync_failed', `HubSpot API error: ${error}`);
      return;
    }

    // Mark sync as succeeded
    await prisma.crmIntegration.update({
      where: { workspaceId },
      data: {
        syncStatus: 'succeeded',
        lastSyncAt: new Date(),
        lastPayloadHash: payloadHash,
        lastErrorAt: null,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await recordHubspotSyncError(workspaceId, 'unexpected_error', errorMessage);
  }
}
