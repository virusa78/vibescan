/**
 * SettingsService
 *
 * Comprehensive user settings management including:
 * - Profile management
 * - Plan and quota information
 * - API key management
 * - Webhook configuration
 * - Notification preferences
 * - Security settings
 * - Regional settings
 * - Data export
 * - Change history
 * - Audit logging
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { getPool } from '../database/client.js';
import { generateSecureString } from '../utils/index.js';
import config from '../config/index.js';
import {
  UserProfile,
  PlanInformation,
  ApiKeyResponse,
  CreateApiKeyResponse,
  Webhook,
  NotificationPreferences,
  RegionalSettings,
  SessionInfo,
  SettingsChange,
  SettingsAuditLog,
  DataExportResponse,
  SettingsBackup,
  PLAN_LIMITS,
  ALLOWED_TIMEZONES,
  ALLOWED_LANGUAGES,
  BLOCKED_DOMAINS,
  BLOCKED_WEBHOOK_DOMAINS,
  API_KEY_SCOPES,
} from '../types/settings.js';

const BCRYPT_ROUNDS = 12;

// Validation functions
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const [, domain] = email.split('@');
  if (BLOCKED_DOMAINS.includes(domain as any)) {
    return false;
  }
  return emailRegex.test(email);
}

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function isValidLanguage(language: string): boolean {
  return ALLOWED_LANGUAGES.includes(language as any);
}

function isValidWebhookUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'https:') {
      return false;
    }
    const hostname = urlObj.hostname;
    if (BLOCKED_WEBHOOK_DOMAINS.includes(hostname as any)) {
      return false;
    }
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.endsWith('.local')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isValidApiKeyScope(scope: string): boolean {
  return Object.values(API_KEY_SCOPES).includes(scope as any);
}

/**
 * SettingsService class
 */
export class SettingsService {
  private pool: any;

  constructor() {
    this.pool = getPool();
  }

  // ==================== PROFILE MANAGEMENT ====================

  /**
   * Get user profile
   */
  async getUserProfile(userId: string): Promise<UserProfile> {
    const result = await this.pool.query(
      `SELECT id, email, name, region, timezone, language, created_at, plan
       FROM users WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw { code: 'not_found', message: 'User not found' };
    }

    const user = result.rows[0];
    return {
      ...user,
      timezone: user.timezone || 'UTC',
      language: user.language || 'en',
    };
  }

  /**
   * Update user profile
   */
  async updateUserProfile(
    userId: string,
    updates: {
      name?: string;
      timezone?: string;
      language?: string;
    }
  ): Promise<UserProfile> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      if (updates.name.length < 1 || updates.name.length > 100) {
        throw { code: 'validation_error', message: 'Name must be 1-100 characters' };
      }
      fields.push(`name = $${paramCount}`);
      values.push(updates.name);
      paramCount++;
    }

    if (updates.timezone !== undefined) {
      if (!isValidTimezone(updates.timezone)) {
        throw { code: 'validation_error', message: 'Invalid timezone' };
      }
      fields.push(`timezone = $${paramCount}`);
      values.push(updates.timezone);
      paramCount++;
    }

    if (updates.language !== undefined) {
      if (!isValidLanguage(updates.language)) {
        throw { code: 'validation_error', message: 'Invalid language' };
      }
      fields.push(`language = $${paramCount}`);
      values.push(updates.language);
      paramCount++;
    }

    // Update users table if name is being changed
    if (fields.length > 0) {
      await this.pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = $${paramCount}`, [...values, userId]);
    }

    // Log the change
    await this.logAuditEvent('profile_update', userId, {
      changed_fields: Object.keys(updates),
      new_values: updates,
    });

    return this.getUserProfile(userId);
  }

  /**
   * Get plan information
   */
  async getPlanInformation(userId: string): Promise<PlanInformation> {
    const userResult = await this.pool.query(
      `SELECT plan, region, created_at FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw { code: 'not_found', message: 'User not found' };
    }

    const { plan, region } = userResult.rows[0];
    const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];

    // Get current month's usage
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usageResult = await this.pool.query(
      `SELECT COALESCE(SUM(scans_used), 0) as used
       FROM quota_ledger
       WHERE user_id = $1 AND month = $2`,
      [userId, currentMonth]
    );

    const scansUsed = parseInt(usageResult.rows[0].used) || 0;
    const monthlyLimit = limits.scans;
    const remaining = monthlyLimit - scansUsed;
    const usagePercentage = Math.round((scansUsed / monthlyLimit) * 100);
    const warning = usagePercentage > 80;

    // Calculate reset date (first of next month)
    const now = new Date();
    const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Get trial end date if on free_trial
    let trialEndDate = null;
    if (plan === 'free_trial') {
      const createdAt = new Date(userResult.rows[0].created_at);
      trialEndDate = new Date(createdAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    }

    return {
      current_plan: plan,
      monthly_limit: monthlyLimit,
      scans_used: scansUsed,
      remaining,
      reset_at: resetAt.toISOString(),
      usage_percentage: usagePercentage,
      warning_flag: warning,
      trial_end_date: trialEndDate?.toISOString() || null,
      next_billing_date: resetAt.toISOString(),
    };
  }

  // ==================== API KEY MANAGEMENT ====================

  /**
   * Create API key
   */
  async createApiKey(
    userId: string,
    request: {
      label: string;
      scopes: string[];
      expires_at?: string;
    }
  ): Promise<CreateApiKeyResponse> {
    // Validate label
    if (!request.label || request.label.length < 1 || request.label.length > 50) {
      throw { code: 'validation_error', message: 'Label must be 1-50 characters' };
    }

    // Validate scopes
    for (const scope of request.scopes) {
      if (!isValidApiKeyScope(scope)) {
        throw {
          code: 'validation_error',
          message: `Invalid scope. Allowed: ${Object.values(API_KEY_SCOPES).join(', ')}`,
          allowed: Object.values(API_KEY_SCOPES),
        };
      }
    }

    // Check rate limit (5 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentKeys = await this.pool.query(
      `SELECT COUNT(*) as count FROM api_keys
       WHERE user_id = $1 AND created_at > $2`,
      [userId, oneHourAgo]
    );

    if (parseInt(recentKeys.rows[0].count) >= 5) {
      throw {
        code: 'rate_limit_exceeded',
        message: 'API key creation rate limit exceeded',
        retry_after: 3600 - Math.floor((Date.now() - oneHourAgo.getTime()) / 1000),
      };
    }

    // Generate API key
    const rawKey = `vs_${generateSecureString(32)}`;
    const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
    const keyPrefix = rawKey.substring(0, 8);

    const result = await this.pool.query(
      `INSERT INTO api_keys (user_id, key_prefix, key_hash, label, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, key_prefix`,
      [userId, keyPrefix, keyHash, request.label, request.scopes, request.expires_at || null]
    );

    // Log the creation
    await this.logAuditEvent('api_key_created', userId, {
      key_id: result.rows[0].id,
      label: request.label,
      scopes: request.scopes,
    });

    return {
      raw_key: rawKey,
      key_id: result.rows[0].id,
      message: 'Store this key securely. It won\'t be shown again.',
    };
  }

  /**
   * List API keys
   */
  async listApiKeys(userId: string): Promise<ApiKeyResponse[]> {
    const result = await this.pool.query(
      `SELECT id, key_prefix, label, scopes, created_at, last_used_at, expires_at, revoked_at
       FROM api_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      key_prefix: row.key_prefix,
      label: row.label,
      scopes: row.scopes,
      created_at: row.created_at,
      last_used_at: row.last_used_at,
      expires_at: row.expires_at,
      revoked_at: row.revoked_at,
    }));
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(userId: string, keyId: string): Promise<void> {
    // Verify ownership
    const apiKey = await this.pool.query(
      'SELECT id FROM api_keys WHERE id = $1 AND user_id = $2',
      [keyId, userId]
    );

    if (apiKey.rows.length === 0) {
      throw { code: 'not_found', message: 'API key not found' };
    }

    await this.pool.query(
      'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1',
      [keyId]
    );

    // Log the revocation
    await this.logAuditEvent('api_key_revoked', userId, {
      key_id: keyId,
    });
  }

  // ==================== WEBHOOK MANAGEMENT ====================

  /**
   * Create webhook
   */
  async createWebhook(
    userId: string,
    request: { url: string; label?: string; enabled?: boolean }
  ): Promise<Webhook> {
    // Validate URL
    if (!isValidWebhookUrl(request.url)) {
      throw {
        code: 'validation_error',
        message: 'Webhook URL must be HTTPS and cannot be localhost/127.0.0.1',
      };
    }

    // Check webhook count limit
    const userWebhooks = await this.pool.query(
      'SELECT COUNT(*) as count FROM webhooks WHERE user_id = $1',
      [userId]
    );

    const user = await this.getUserProfile(userId);
    const limit = PLAN_LIMITS[user.plan as keyof typeof PLAN_LIMITS].webhooks;

    if (parseInt(userWebhooks.rows[0].count) >= limit) {
      throw {
        code: 'quota_exceeded',
        message: 'Webhook limit reached for your plan',
        remaining: 0,
        reset_at: null,
      };
    }

    // Generate signing secret
    const signingSecret = crypto.randomBytes(32).toString('hex');

    const result = await this.pool.query(
      `INSERT INTO webhooks (user_id, url, signing_secret_encrypted, enabled)
       VALUES ($1, $2, pgp_sym_encrypt($3, $4), $5)
       RETURNING id, user_id, url, enabled, created_at`,
      [
        userId,
        request.url,
        signingSecret,
        config.ENCRYPTION_KEY,
        request.enabled !== false,
      ]
    );

    // Log the creation
    await this.logAuditEvent('webhook_created', userId, {
      webhook_id: result.rows[0].id,
      url: request.url,
    });

    return result.rows[0];
  }

  /**
   * List webhooks
   */
  async listWebhooks(userId: string): Promise<(Webhook & { last_delivery_status: string })[]> {
    const result = await this.pool.query(
      `SELECT w.id, w.user_id, w.url, w.enabled, w.created_at,
              COALESCE(hd.status, 'pending') as last_delivery_status
       FROM webhooks w
       LEFT JOIN LATERAL (
         SELECT status, created_at
         FROM webhook_deliveries
         WHERE webhook_id = w.id
         ORDER BY created_at DESC
         LIMIT 1
       ) hd ON TRUE
       WHERE w.user_id = $1
       ORDER BY w.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      url: row.url,
      signing_secret: '', // Never return the secret
      enabled: row.enabled,
      created_at: row.created_at,
      updated_at: null,
      last_delivery_status: row.last_delivery_status || 'pending',
    }));
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = await this.pool.query(
      'SELECT id FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhookId, userId]
    );

    if (webhook.rows.length === 0) {
      throw { code: 'not_found', message: 'Webhook not found' };
    }

    await this.pool.query('DELETE FROM webhooks WHERE id = $1', [webhookId]);

    // Log the deletion
    await this.logAuditEvent('webhook_deleted', userId, {
      webhook_id: webhookId,
    });
  }

  /**
   * Update webhook URL or enabled state; rotate secret when URL changes.
   */
  async updateWebhook(
    userId: string,
    webhookId: string,
    updates: { url?: string; enabled?: boolean }
  ): Promise<Webhook> {
    const current = await this.pool.query(
      'SELECT id, user_id, url, enabled, created_at FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhookId, userId]
    );
    if (current.rows.length === 0) {
      throw { code: 'not_found', message: 'Webhook not found' };
    }

    const fields: string[] = [];
    const values: any[] = [];
    let p = 1;

    if (updates.url !== undefined) {
      if (!isValidWebhookUrl(updates.url)) {
        throw { code: 'validation_error', message: 'Webhook URL must be HTTPS and cannot be localhost/127.0.0.1' };
      }
      fields.push(`url = $${p++}`);
      values.push(updates.url);

      const rotatedSecret = crypto.randomBytes(32).toString('hex');
      fields.push(`signing_secret_encrypted = pgp_sym_encrypt($${p++}, $${p++})`);
      values.push(rotatedSecret, config.ENCRYPTION_KEY);
    }

    if (updates.enabled !== undefined) {
      fields.push(`enabled = $${p++}`);
      values.push(!!updates.enabled);
    }

    if (fields.length > 0) {
      values.push(webhookId, userId);
      await this.pool.query(
        `UPDATE webhooks SET ${fields.join(', ')} WHERE id = $${p++} AND user_id = $${p}`,
        values
      );
    }

    const updated = await this.pool.query(
      'SELECT id, user_id, url, enabled, created_at FROM webhooks WHERE id = $1 AND user_id = $2',
      [webhookId, userId]
    );

    await this.logAuditEvent('webhook_updated', userId, {
      webhook_id: webhookId,
      changed_fields: Object.keys(updates),
    });

    return { ...updated.rows[0], signing_secret: '' };
  }

  // ==================== NOTIFICATION PREFERENCES ====================

  /**
   * Get notification preferences
   */
  async getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const result = await this.pool.query(
      `SELECT user_id, email_enabled, webhook_enabled, slack_enabled, preferred_delivery_time
       FROM notification_preferences
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return default preferences
      return {
        user_id: userId,
        email_enabled: true,
        webhook_enabled: false,
        slack_enabled: false,
      };
    }

    return {
      user_id: userId,
      ...result.rows[0],
    };
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    userId: string,
    updates: {
      email_enabled?: boolean;
      webhook_enabled?: boolean;
      slack_enabled?: boolean;
      preferred_delivery_time?: string;
    }
  ): Promise<NotificationPreferences> {
    // Validate delivery time format
    if (updates.preferred_delivery_time) {
      const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
      if (!timeRegex.test(updates.preferred_delivery_time)) {
        throw { code: 'validation_error', message: 'Invalid time format. Use HH:MM' };
      }
    }

    const existing = await this.getNotificationPreferences(userId);
    const merged = {
      email_enabled: updates.email_enabled !== undefined ? updates.email_enabled : existing.email_enabled,
      webhook_enabled: updates.webhook_enabled !== undefined ? updates.webhook_enabled : existing.webhook_enabled,
      slack_enabled: updates.slack_enabled !== undefined ? updates.slack_enabled : existing.slack_enabled,
      preferred_delivery_time:
        updates.preferred_delivery_time !== undefined
          ? updates.preferred_delivery_time
          : existing.preferred_delivery_time || null,
    };

    // Upsert notification preferences
    const result = await this.pool.query(
      `INSERT INTO notification_preferences (user_id, email_enabled, webhook_enabled, slack_enabled, preferred_delivery_time)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
          email_enabled = EXCLUDED.email_enabled,
         webhook_enabled = EXCLUDED.webhook_enabled,
         slack_enabled = EXCLUDED.slack_enabled,
         preferred_delivery_time = EXCLUDED.preferred_delivery_time
       RETURNING user_id, email_enabled, webhook_enabled, slack_enabled, preferred_delivery_time`,
      [
        userId,
        merged.email_enabled,
        merged.webhook_enabled,
        merged.slack_enabled,
        merged.preferred_delivery_time,
      ]
    );

    // Log the update
    await this.logAuditEvent('notifications_updated', userId, {
      changes: Object.keys(updates),
    });

    return result.rows[0];
  }

  // ==================== SECURITY SETTINGS ====================

  /**
   * Get security settings (active sessions)
   */
  async getSecuritySettings(userId: string): Promise<{ sessions: SessionInfo[] }> {
    // This would require Redis session store access
    // For now, return empty sessions
    // TODO: Implement session tracking in Redis
    return {
      sessions: [],
    };
  }

  /**
   * Revoke session
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    // Delete from Redis session store
    const { deleteSession } = await import('../redis/sessions.js');
    await deleteSession(sessionId);

    // Log the revocation
    await this.logAuditEvent('session_revoked', userId, {
      session_id: sessionId,
    });
  }

  // ==================== REGIONAL SETTINGS ====================

  /**
   * Get regional settings
   */
  async getRegionalSettings(userId: string): Promise<RegionalSettings> {
    const userResult = await this.pool.query(
      `SELECT timezone, language FROM users WHERE id = $1`,
      [userId]
    );
    if (userResult.rows.length === 0) {
      throw { code: 'not_found', message: 'User not found' };
    }

    const result = await this.pool.query(
      `SELECT currency, date_format, number_format
       FROM user_settings
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return defaults
      return {
        user_id: userId,
        timezone: userResult.rows[0].timezone || 'UTC',
        language: userResult.rows[0].language || 'en',
        currency: 'USD',
        date_format: 'auto',
        number_format: '1,000.00',
      };
    }

    return {
      user_id: userId,
      timezone: userResult.rows[0].timezone || 'UTC',
      language: userResult.rows[0].language || 'en',
      currency: result.rows[0].currency,
      date_format: result.rows[0].date_format,
      number_format: result.rows[0].number_format,
    };
  }

  /**
   * Update regional settings
   */
  async updateRegionalSettings(
    userId: string,
    updates: {
      timezone?: string;
      language?: string;
      currency?: string;
      date_format?: string;
      number_format?: string;
    }
  ): Promise<RegionalSettings> {
    const userFields: string[] = [];
    const userValues: any[] = [];
    let userParamCount = 1;

    const settingsColumns: string[] = [];
    const settingsAssignments: string[] = [];
    const settingsValues: any[] = [];

    if (updates.timezone !== undefined) {
      if (!isValidTimezone(updates.timezone)) {
        throw { code: 'validation_error', message: 'Invalid timezone' };
      }
      userFields.push(`timezone = $${userParamCount++}`);
      userValues.push(updates.timezone);
    }

    if (updates.language !== undefined) {
      if (!isValidLanguage(updates.language)) {
        throw { code: 'validation_error', message: 'Invalid language' };
      }
      userFields.push(`language = $${userParamCount++}`);
      userValues.push(updates.language);
    }

    if (updates.currency !== undefined) {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'INR', 'PKR'];
      if (!validCurrencies.includes(updates.currency)) {
        throw { code: 'validation_error', message: 'Invalid currency' };
      }
      settingsColumns.push('currency');
      settingsAssignments.push('currency = EXCLUDED.currency');
      settingsValues.push(updates.currency);
    }

    if (updates.date_format !== undefined) {
      settingsColumns.push('date_format');
      settingsAssignments.push('date_format = EXCLUDED.date_format');
      settingsValues.push(updates.date_format);
    }

    if (updates.number_format !== undefined) {
      settingsColumns.push('number_format');
      settingsAssignments.push('number_format = EXCLUDED.number_format');
      settingsValues.push(updates.number_format);
    }

    if (userFields.length === 0 && settingsColumns.length === 0) {
      return this.getRegionalSettings(userId);
    }

    if (userFields.length > 0) {
      await this.pool.query(
        `UPDATE users SET ${userFields.join(', ')} WHERE id = $${userParamCount}`,
        [...userValues, userId]
      );
    }

    if (settingsColumns.length > 0) {
      await this.pool.query(
        `INSERT INTO user_settings (user_id, ${settingsColumns.join(', ')})
         VALUES ($1, ${settingsColumns.map((_, i) => `$${i + 2}`).join(', ')})
         ON CONFLICT (user_id) DO UPDATE SET ${settingsAssignments.join(', ')}`,
        [userId, ...settingsValues]
      );
    }

    // Log the update
    await this.logAuditEvent('regional_settings_updated', userId, {
      changes: Object.keys(updates),
    });

    return this.getRegionalSettings(userId);
  }

  // ==================== AUDIT LOGGING ====================

  /**
   * Log audit event
   */
  async logAuditEvent(
    eventType: string,
    userId: string,
    metadata: Record<string, any>
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO settings_audit_logs (event_type, user_id, metadata, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [eventType, userId, JSON.stringify(metadata)]
    );
  }

  /**
   * Get change history
   */
  async getChangeHistory(
    userId: string,
    filters?: {
      field_name?: string;
      date_from?: string;
      date_to?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ items: SettingsChange[]; total: number; limit: number; offset: number }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    let query = `
      SELECT id, user_id, event_type, metadata, created_at
      FROM settings_audit_logs
      WHERE user_id = $1
    `;
    const params: any[] = [userId];
    let paramCount = 2;

    if (filters?.field_name) {
      query += ` AND event_type = $${paramCount}`;
      params.push(filters.field_name);
      paramCount++;
    }

    if (filters?.date_from) {
      query += ` AND created_at >= $${paramCount}`;
      params.push(filters.date_from);
      paramCount++;
    }

    if (filters?.date_to) {
      query += ` AND created_at <= $${paramCount}`;
      params.push(filters.date_to);
      paramCount++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await this.pool.query(query, params);

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM settings_audit_logs WHERE user_id = $1`,
      [userId]
    );

    return {
      items: result.rows.map((row: any) => {
        const sensitive = row.event_type === 'password_changed' || row.event_type === 'email_change_requested';
        return {
          id: row.id,
          user_id: row.user_id,
          field_name: row.event_type,
          old_value: sensitive ? null : row.metadata?.old_value ?? null,
          new_value: sensitive ? null : row.metadata?.new_value ?? null,
          changed_at: row.created_at,
          changed_by: row.metadata?.changed_by || 'user',
          security_context: row.metadata || {},
        };
      }),
      total: parseInt(countResult.rows[0].total),
      limit,
      offset,
    };
  }

  async getAuditLog(
    userId: string,
    filters?: { event_type?: string; date_from?: string; date_to?: string; limit?: number; offset?: number }
  ): Promise<{ items: SettingsAuditLog[]; total: number; limit: number; offset: number }> {
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;
    const params: any[] = [userId];
    let p = 2;
    let where = 'WHERE user_id = $1';

    if (filters?.event_type) {
      where += ` AND event_type = $${p++}`;
      params.push(filters.event_type);
    }
    if (filters?.date_from) {
      where += ` AND created_at >= $${p++}`;
      params.push(filters.date_from);
    }
    if (filters?.date_to) {
      where += ` AND created_at <= $${p++}`;
      params.push(filters.date_to);
    }

    const result = await this.pool.query(
      `SELECT id, event_type, user_id, created_at as timestamp, metadata, ip_address, user_agent
       FROM settings_audit_logs
       ${where}
       ORDER BY created_at DESC
       LIMIT $${p} OFFSET $${p + 1}`,
      [...params, limit, offset]
    );

    const count = await this.pool.query(`SELECT COUNT(*) as total FROM settings_audit_logs ${where}`, params);
    return { items: result.rows, total: parseInt(count.rows[0].total), limit, offset };
  }

  async getPlanHistory(userId: string): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, metadata, created_at
       FROM settings_audit_logs
       WHERE user_id = $1 AND event_type IN ('plan_changed', 'subscription_changed')
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );
    return result.rows.map((row: any) => ({
      id: row.id,
      old_plan: row.metadata?.old_plan || null,
      new_plan: row.metadata?.new_plan || null,
      changed_at: row.created_at,
      changed_by: row.metadata?.changed_by || 'system',
    }));
  }

  async getSecurityEvents(userId: string, limit: number = 50): Promise<any[]> {
    const result = await this.pool.query(
      `SELECT id, event_type, created_at, metadata
       FROM settings_audit_logs
       WHERE user_id = $1
         AND event_type IN ('login_failed', 'suspicious_activity', 'password_changed', 'session_revoked')
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, Math.max(1, Math.min(limit, 200))]
    );
    return result.rows;
  }

  // ==================== DATA EXPORT ====================

  /**
   * Export user data
   */
  async exportUserData(
    userId: string,
    options: {
      include_api_keys?: boolean;
      include_webhooks?: boolean;
      include_notifications?: boolean;
    } = {}
  ): Promise<DataExportResponse & { status: string }> {
    // Gather all data
    const profile = await this.getUserProfile(userId);
    const notifications = await this.getNotificationPreferences(userId);
    const regional = await this.getRegionalSettings(userId);
    const plan = await this.getPlanInformation(userId);

    const exportData: any = {
      profile: {
        email: profile.email,
        name: profile.name,
        region: profile.region,
        timezone: profile.timezone,
        language: profile.language,
        created_at: profile.created_at,
      },
      plan: {
        current_plan: plan.current_plan,
        monthly_limit: plan.monthly_limit,
      },
      notifications,
      regional,
      export_timestamp: new Date().toISOString(),
    };

    if (options.include_api_keys) {
      exportData.api_keys = await this.listApiKeys(userId);
    }

    if (options.include_webhooks) {
      exportData.webhooks = await this.listWebhooks(userId);
    }

    // Generate export ID
    const exportId = uuidv4();
    const filename = `settings-export-${userId}-${Date.now()}.json`;
    const s3Key = `exports/${filename}`;

    // Store export metadata
    await this.pool.query(
      `INSERT INTO settings_exports (export_id, user_id, s3_key, export_timestamp, status)
       VALUES ($1, $2, $3, NOW(), 'completed')`,
      [exportId, userId, s3Key]
    );

    // TODO: Upload to S3

    // Log the export
    await this.logAuditEvent('settings_exported', userId, {
      export_id: exportId,
      included_data: options,
    });

    return {
      export_id: exportId,
      s3_key: s3Key,
      export_timestamp: new Date().toISOString(),
      user_id: userId,
      download_url: `/settings/export/${exportId}/download`,
      status: 'completed',
    };
  }

  async getExportStatus(userId: string, exportId: string): Promise<{ job_id: string; status: string; s3_key: string }> {
    const result = await this.pool.query(
      `SELECT export_id, status, s3_key FROM settings_exports WHERE export_id = $1 AND user_id = $2`,
      [exportId, userId]
    );
    if (result.rows.length === 0) {
      throw { code: 'not_found', message: 'Export job not found' };
    }
    return { job_id: result.rows[0].export_id, status: result.rows[0].status, s3_key: result.rows[0].s3_key };
  }
}

export const settingsService = new SettingsService();

export default settingsService;
