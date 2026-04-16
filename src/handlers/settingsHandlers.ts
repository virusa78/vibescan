/**
 * Settings API Handlers
 *
 * Handles all /settings/* endpoints including:
 * - Profile management
 * - Plan and quota information
 * - API key management
 * - Webhook configuration
 * - Notification preferences
 * - Security settings
 * - Regional settings
 * - Data export
 * - Change history
 */

import { settingsService } from '../services/settingsService.js';
import { createError } from '../utils/index.js';
import { getRedisClient } from '../redis/client.js';
import type {
  UserProfile,
  PlanInformation,
  ApiKeyResponse,
  CreateApiKeyResponse,
  Webhook,
  NotificationPreferences,
  RegionalSettings,
  SessionInfo,
  SettingsChange,
} from '../types/settings.js';

async function invalidateSettingsCache(userId: string): Promise<void> {
  const redis = await getRedisClient();
  await redis.del(`settings:all:${userId}`);
}

/**
 * GET /settings
 * Returns all user settings in a single response
 */
export async function getAllSettingsHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const redis = await getRedisClient();
    const cacheKey = `settings:all:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      reply.header('Cache-Control', 'private, max-age=300');
      reply.header('X-Cache', 'HIT');
      reply.code(200).send(JSON.parse(cached));
      return;
    }

    const [profile, plan, apiKeys, webhooks, notifications, regional, security] = await Promise.all([
      settingsService.getUserProfile(userId),
      settingsService.getPlanInformation(userId),
      settingsService.listApiKeys(userId),
      settingsService.listWebhooks(userId),
      settingsService.getNotificationPreferences(userId),
      settingsService.getRegionalSettings(userId),
      settingsService.getSecuritySettings(userId),
    ]);

    const payload = {
      success: true,
      data: {
        profile,
        plan,
        apiKeys,
        webhooks,
        notifications,
        regional,
        security,
      },
    };

    await redis.setEx(cacheKey, 300, JSON.stringify(payload));
    reply.header('Cache-Control', 'private, max-age=300');
    reply.header('X-Cache', 'MISS');
    reply.code(200).send(payload);
  } catch (error: any) {
    console.error('Get all settings error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch settings' });
  }
}

/**
 * GET /settings/profile
 * Returns current user profile
 */
export async function getProfileHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const profile = await settingsService.getUserProfile(userId);

    reply.code(200).send({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch profile' });
  }
}

/**
 * PATCH /settings/profile
 * Updates user profile fields
 */
export async function updateProfileHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const updates = request.body;

    // Validate name if present
    if (updates.name !== undefined) {
      if (typeof updates.name !== 'string' || updates.name.length < 1 || updates.name.length > 100) {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'name', message: 'Name must be 1-100 characters' },
          ],
        });
        return;
      }
    }

    // Validate timezone if present
    if (updates.timezone !== undefined) {
      if (typeof updates.timezone !== 'string') {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'timezone', message: 'Invalid timezone format' },
          ],
        });
        return;
      }
    }

    // Validate language if present
    if (updates.language !== undefined) {
      const validLanguages = ['en', 'es', 'fr', 'de', 'ja', 'zh'];
      if (!validLanguages.includes(updates.language)) {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'language', message: `Invalid language. Allowed: ${validLanguages.join(', ')}` },
          ],
        });
        return;
      }
    }

    const profile = await settingsService.updateUserProfile(userId, updates);
    await invalidateSettingsCache(userId);

    reply.code(200).send({
      success: true,
      data: profile,
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    if (error.code === 'validation_error') {
      reply.code(400).send(error);
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to update profile' });
    }
  }
}

/**
 * GET /settings/plan
 * Returns current plan and quota information
 */
export async function getPlanHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const planInfo = await settingsService.getPlanInformation(userId);

    reply.code(200).send({
      success: true,
      data: planInfo,
    });
  } catch (error: any) {
    console.error('Get plan error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch plan information' });
  }
}

/**
 * GET /settings/api-keys
 * Lists all API keys for the user
 */
export async function listApiKeysHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const apiKeys = await settingsService.listApiKeys(userId);

    reply.code(200).send({
      success: true,
      data: apiKeys,
    });
  } catch (error: any) {
    console.error('List API keys error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch API keys' });
  }
}

/**
 * POST /settings/api-keys
 * Creates a new API key
 */
export async function createApiKeyHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const { label, scopes = ['scan_read'], expires_at } = request.body;

    // Validate label
    if (!label || typeof label !== 'string' || label.length < 1 || label.length > 50) {
      reply.code(400).send({
        error: 'validation_error',
        validation_errors: [
          { field: 'label', message: 'Label must be 1-50 characters' },
        ],
      });
      return;
    }

    // Validate scopes
    const validScopes = ['sbom_submit', 'scan_read', 'webhook_manage', 'settings_manage'];
    for (const scope of scopes) {
      if (!validScopes.includes(scope)) {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            {
              field: 'scopes',
              message: `Invalid scope. Allowed: ${validScopes.join(', ')}`,
              allowed: validScopes,
            },
          ],
        });
        return;
      }
    }

    const result = await settingsService.createApiKey(userId, {
      label,
      scopes,
      expires_at,
    });
    await invalidateSettingsCache(userId);

    reply.code(201).send({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Create API key error:', error);
    if (error.code === 'validation_error') {
      reply.code(400).send(error);
    } else if (error.code === 'rate_limit_exceeded') {
      reply.code(429).send(error);
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to create API key' });
    }
  }
}

/**
 * DELETE /settings/api-keys/:id
 * Revokes an API key
 */
export async function revokeApiKeyHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const { id } = request.params;

    await settingsService.revokeApiKey(userId, id);
    await invalidateSettingsCache(userId);

    reply.code(204).send();
  } catch (error: any) {
    console.error('Revoke API key error:', error);
    if (error.code === 'not_found') {
      reply.code(404).send({ error: 'not_found', message: 'API key not found' });
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to revoke API key' });
    }
  }
}

/**
 * GET /settings/webhooks
 * Lists all webhooks
 */
export async function listWebhooksHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const webhooks = await settingsService.listWebhooks(userId);

    reply.code(200).send({
      success: true,
      data: webhooks,
    });
  } catch (error: any) {
    console.error('List webhooks error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch webhooks' });
  }
}

/**
 * POST /settings/webhooks
 * Creates a new webhook
 */
export async function createWebhookHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const { url, label, enabled = true } = request.body;

    // Validate URL
    if (!url || typeof url !== 'string') {
      reply.code(400).send({
        error: 'validation_error',
        validation_errors: [
          { field: 'url', message: 'URL is required' },
        ],
      });
      return;
    }

    const webhook = await settingsService.createWebhook(userId, {
      url,
      label,
      enabled,
    });
    await invalidateSettingsCache(userId);

    reply.code(201).send({
      success: true,
      data: webhook,
    });
  } catch (error: any) {
    console.error('Create webhook error:', error);
    if (error.code === 'validation_error') {
      reply.code(400).send(error);
    } else if (error.code === 'quota_exceeded') {
      reply.code(403).send(error);
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to create webhook' });
    }
  }
}

/**
 * DELETE /settings/webhooks/:id
 * Deletes a webhook
 */
export async function deleteWebhookHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const { id } = request.params;

    await settingsService.deleteWebhook(userId, id);
    await invalidateSettingsCache(userId);

    reply.code(204).send();
  } catch (error: any) {
    console.error('Delete webhook error:', error);
    if (error.code === 'not_found') {
      reply.code(404).send({ error: 'not_found', message: 'Webhook not found' });
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to delete webhook' });
    }
  }
}

/**
 * GET /settings/notifications
 * Returns notification preferences
 */
export async function getNotificationsHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const preferences = await settingsService.getNotificationPreferences(userId);

    reply.code(200).send({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Get notifications error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch notification preferences' });
  }
}

/**
 * PATCH /settings/notifications
 * Updates notification preferences
 */
export async function updateNotificationsHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const updates = request.body;

    // Validate preferred_delivery_time format
    if (updates.preferred_delivery_time !== undefined) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(updates.preferred_delivery_time)) {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'preferred_delivery_time', message: 'Invalid time format. Use HH:MM' },
          ],
        });
        return;
      }

      // Validate against user's IANA timezone presence
      const profile = await settingsService.getUserProfile(userId);
      try {
        Intl.DateTimeFormat(undefined, { timeZone: profile.timezone || 'UTC' });
      } catch {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'preferred_delivery_time', message: 'User timezone is invalid for delivery-time validation' },
          ],
        });
        return;
      }
    }

    const preferences = await settingsService.updateNotificationPreferences(userId, updates);
    await invalidateSettingsCache(userId);

    reply.code(200).send({
      success: true,
      data: preferences,
    });
  } catch (error: any) {
    console.error('Update notifications error:', error);
    if (error.code === 'validation_error') {
      reply.code(400).send(error);
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to update notification preferences' });
    }
  }
}

/**
 * GET /settings/security
 * Returns security settings including active sessions
 */
export async function getSecurityHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const security = await settingsService.getSecuritySettings(userId);

    reply.code(200).send({
      success: true,
      data: security,
    });
  } catch (error: any) {
    console.error('Get security error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch security settings' });
  }
}

/**
 * POST /settings/security/revoke-session/:id
 * Revokes a specific session
 */
export async function revokeSessionHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const { id } = request.params;

    await settingsService.revokeSession(userId, id);
    await invalidateSettingsCache(userId);

    reply.code(204).send();
  } catch (error: any) {
    console.error('Revoke session error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to revoke session' });
  }
}

/**
 * GET /settings/regional
 * Returns regional settings
 */
export async function getRegionalHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const settings = await settingsService.getRegionalSettings(userId);

    reply.code(200).send({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Get regional settings error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch regional settings' });
  }
}

/**
 * PATCH /settings/regional
 * Updates regional settings
 */
export async function updateRegionalHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const updates = request.body;

    // Validate currency
    if (updates.currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'PKR'];
      if (!validCurrencies.includes(updates.currency)) {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'currency', message: `Invalid currency. Allowed: ${validCurrencies.join(', ')}` },
          ],
        });
        return;
      }
    }

    // Validate date_format
    if (updates.date_format !== undefined) {
      const validFormats = ['MM/DD/YYYY', 'DD/MM/YYYY', 'auto'];
      if (!validFormats.includes(updates.date_format)) {
        reply.code(400).send({
          error: 'validation_error',
          validation_errors: [
            { field: 'date_format', message: `Invalid format. Allowed: ${validFormats.join(', ')}` },
          ],
        });
        return;
      }
    }

    const settings = await settingsService.updateRegionalSettings(userId, updates);
    await invalidateSettingsCache(userId);

    reply.code(200).send({
      success: true,
      data: settings,
    });
  } catch (error: any) {
    console.error('Update regional settings error:', error);
    if (error.code === 'validation_error') {
      reply.code(400).send(error);
    } else {
      reply.code(500).send({ error: 'internal_error', message: 'Failed to update regional settings' });
    }
  }
}

/**
 * GET /settings/history
 * Returns settings change history
 */
export async function getHistoryHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const { field_name, date_from, date_to, limit, offset } = request.query;

    const history = await settingsService.getChangeHistory(userId, {
      field_name: field_name as string,
      date_from: date_from as string,
      date_to: date_to as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });

    reply.code(200).send({
      success: true,
      data: history,
    });
  } catch (error: any) {
    console.error('Get history error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch change history' });
  }
}

/**
 * POST /settings/export
 * Initiates data export
 */
export async function createExportHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }

    const options = request.body || {};

    const exportResult = await settingsService.exportUserData(userId, options);

    reply.code(201).send({
      success: true,
      data: exportResult,
    });
  } catch (error: any) {
    console.error('Create export error:', error);
    reply.code(500).send({ error: 'internal_error', message: 'Failed to create export' });
  }
}

/**
 * GET /settings/plan/history
 */
export async function getPlanHistoryHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    const items = await settingsService.getPlanHistory(userId);
    reply.code(200).send({ success: true, data: { items } });
  } catch (error: any) {
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch plan history' });
  }
}

/**
 * PATCH /settings/webhooks/:id
 */
export async function updateWebhookHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    const { id } = request.params;
    const webhook = await settingsService.updateWebhook(userId, id, request.body || {});
    await invalidateSettingsCache(userId);
    reply.code(200).send({ success: true, data: webhook });
  } catch (error: any) {
    if (error.code === 'validation_error') {
      reply.code(400).send({ error: 'validation_error', validation_errors: [{ field: 'url', message: error.message }] });
      return;
    }
    if (error.code === 'not_found') {
      reply.code(404).send({ error: 'not_found', message: error.message });
      return;
    }
    reply.code(500).send({ error: 'internal_error', message: 'Failed to update webhook' });
  }
}

/**
 * POST /settings/webhooks/:id/test
 */
export async function testWebhookHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    // This endpoint currently validates ownership and queues a no-op test marker.
    const { id } = request.params;
    await settingsService.updateWebhook(userId, id, {});
    reply.code(202).send({ success: true, data: { status: 'queued' } });
  } catch (error: any) {
    if (error.code === 'not_found') {
      reply.code(404).send({ error: 'not_found', message: error.message });
      return;
    }
    reply.code(500).send({ error: 'internal_error', message: 'Failed to queue webhook test' });
  }
}

/**
 * GET /settings/security/events
 */
export async function getSecurityEventsHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    const limit = request.query?.limit ? parseInt(request.query.limit, 10) : 50;
    const items = await settingsService.getSecurityEvents(userId, limit);
    reply.code(200).send({ success: true, data: { items } });
  } catch (error: any) {
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch security events' });
  }
}

/**
 * GET /settings/export/:jobId
 */
export async function getExportStatusHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    const { jobId } = request.params;
    const status = await settingsService.getExportStatus(userId, jobId);
    reply.code(200).send({ success: true, data: status });
  } catch (error: any) {
    if (error.code === 'not_found') {
      reply.code(404).send({ error: 'not_found', message: error.message });
      return;
    }
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch export status' });
  }
}

/**
 * GET /settings/export/:jobId/download
 */
export async function downloadExportHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    const { jobId } = request.params;
    const status = await settingsService.getExportStatus(userId, jobId);
    reply.code(200).send({ success: true, data: { s3_key: status.s3_key, status: status.status } });
  } catch (error: any) {
    if (error.code === 'not_found') {
      reply.code(404).send({ error: 'not_found', message: error.message });
      return;
    }
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch export download' });
  }
}

/**
 * GET /settings/audit-log
 */
export async function getAuditLogHandler(request: any, reply: any): Promise<void> {
  try {
    const userId = request.user?.userId;
    if (!userId) {
      reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
      return;
    }
    const { event_type, date_from, date_to, limit, offset } = request.query || {};
    const data = await settingsService.getAuditLog(userId, {
      event_type,
      date_from,
      date_to,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
    reply.code(200).send({ success: true, data });
  } catch (error: any) {
    reply.code(500).send({ error: 'internal_error', message: 'Failed to fetch audit log' });
  }
}

export default {
  getAllSettingsHandler,
  getProfileHandler,
  updateProfileHandler,
  getPlanHandler,
  getPlanHistoryHandler,
  listApiKeysHandler,
  createApiKeyHandler,
  revokeApiKeyHandler,
  listWebhooksHandler,
  createWebhookHandler,
  updateWebhookHandler,
  deleteWebhookHandler,
  testWebhookHandler,
  getNotificationsHandler,
  updateNotificationsHandler,
  getSecurityHandler,
  getSecurityEventsHandler,
  revokeSessionHandler,
  getRegionalHandler,
  updateRegionalHandler,
  getHistoryHandler,
  getAuditLogHandler,
  createExportHandler,
  getExportStatusHandler,
  downloadExportHandler,
};
