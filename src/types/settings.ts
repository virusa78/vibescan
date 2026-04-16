/**
 * Settings types
 *
 * Type definitions for user settings, preferences, and management
 */

import type { Region, PlanTier } from './index.js';

// Settings types
export interface UserProfile {
  id: string;
  email: string;
  name?: string;
  region: Region;
  timezone: string;
  language: Language;
  created_at: string;
  plan: PlanTier;
  quota?: number;
  quota_used?: number;
}

export type Language = 'en' | 'es' | 'fr' | 'de' | 'ja' | 'zh';

export interface UpdateProfileRequest {
  name?: string;
  timezone?: string;
  language?: Language;
}

export interface EmailChangeRequest {
  new_email: string;
  current_password: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}

// Plan and quota types
export interface PlanInformation {
  current_plan: PlanTier;
  monthly_limit: number;
  scans_used: number;
  remaining: number;
  reset_at: string;
  next_billing_date?: string;
  trial_end_date?: string;
  usage_percentage: number;
  warning_flag?: boolean;
}

export interface PlanHistoryEntry {
  id: string;
  user_id: string;
  old_plan: PlanTier;
  new_plan: PlanTier;
  changed_at: string;
  changed_by: 'user' | 'admin' | 'system';
}

// API key types
export interface CreateApiKeyRequest {
  label: string;
  scopes: ApiKeyScope[];
  expires_at?: string;
}

export type ApiKeyScope = 'sbom_submit' | 'scan_read' | 'webhook_manage' | 'settings_manage';

export interface ApiKeyResponse {
  id: string;
  key_prefix: string;
  label: string;
  scopes: ApiKeyScope[];
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked_at?: string;
}

export interface CreateApiKeyResponse {
  raw_key: string;
  key_id: string;
  message: string;
}

// Webhook types
export interface CreateWebhookRequest {
  url: string;
  label?: string;
  enabled?: boolean;
}

export interface Webhook {
  id: string;
  user_id: string;
  url: string;
  signing_secret: string;
  enabled: boolean;
  created_at: string;
  updated_at?: string;
}

export interface WebhookDeliveryStatus {
  webhook_id: string;
  last_delivery_status: 'success' | 'failed' | 'pending';
  last_delivery_at?: string;
}

// Notification preferences
export interface NotificationPreferences {
  user_id: string;
  email_enabled: boolean;
  webhook_enabled: boolean;
  slack_enabled: boolean;
  preferred_delivery_time?: string; // HH:MM format
}

export interface UpdateNotificationsRequest {
  email_enabled?: boolean;
  webhook_enabled?: boolean;
  slack_enabled?: boolean;
  preferred_delivery_time?: string;
}

// Security settings
export interface SessionInfo {
  id: string;
  user_id: string;
  device_info: string;
  ip_address: string;
  created_at: string;
  last_active_at: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

// Regional settings
export interface RegionalSettings {
  user_id: string;
  timezone: string;
  language: Language;
  currency: Currency;
  date_format: DateFormat;
  number_format: NumberFormat;
}

export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR' | 'PKR';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'auto';
export type NumberFormat = '1,000.00' | '1.000,00' | '1 000,00';

export interface UpdateRegionalRequest {
  timezone?: string;
  language?: Language;
  currency?: Currency;
  date_format?: DateFormat;
  number_format?: NumberFormat;
}

// Data export
export interface DataExportRequest {
  include_api_keys?: boolean;
  include_webhooks?: boolean;
  include_notifications?: boolean;
}

export interface DataExportResponse {
  export_id: string;
  s3_key: string;
  export_timestamp: string;
  user_id: string;
  download_url: string;
}

// Change history
export interface SettingsChange {
  id: string;
  user_id: string;
  field_name: string;
  old_value: any;
  new_value: any;
  changed_at: string;
  changed_by: 'user' | 'admin' | 'system';
  security_context?: any;
}

export interface ChangeHistoryFilters {
  field_name?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

// Validation errors
export interface ValidationError {
  field: string;
  message: string;
}

export interface SettingsErrorResponse {
  error: string;
  validation_errors?: ValidationError[];
  allowed?: string[];
  remaining?: number;
  reset_at?: string;
  retry_after?: number;
}

// API key scopes for permissions
export const API_KEY_SCOPES = {
  sbom_submit: 'sbom_submit',
  scan_read: 'scan_read',
  webhook_manage: 'webhook_manage',
  settings_manage: 'settings_manage'
} as const;

export const ALLOWED_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Mumbai',
  'Asia/Dubai',
] as const;

export const ALLOWED_LANGUAGES = ['en', 'es', 'fr', 'de', 'ja', 'zh'] as const;

export const BLOCKED_DOMAINS = [
  'tempmail.com',
  'guerrillamail.com',
  'mailinator.com',
] as const;

export const BLOCKED_WEBHOOK_DOMAINS = [
  'webhook.site',
  'requestbin.com',
] as const;

export const NOTIFICATION_DELIVERY_CHANNELS = ['email', 'webhook', 'slack'] as const;

export const SETTINGS_RATE_LIMITS = {
  profile_update: { requests: 10, window: 60 }, // 10 per minute
  api_key_create: { requests: 5, window: 3600 }, // 5 per hour
  webhook_create: { requests: 10, window: 3600 }, // 10 per hour
  general: { requests: 100, window: 60 }, // 100 per minute for other settings
} as const;

export const PLAN_LIMITS = {
  free_trial: { scans: 10, webhooks: 3 },
  starter: { scans: 50, webhooks: 5 },
  pro: { scans: 100, webhooks: 10 },
  enterprise: { scans: 1000, webhooks: 50 },
} as const;

export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  PKR: '₨',
} as const;

// Audit log types
export interface SettingsAuditLog {
  id: string;
  event_type: string;
  user_id: string;
  timestamp: string;
  metadata: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
}

export type AuditEventType =
  | 'profile_update'
  | 'email_change_requested'
  | 'password_changed'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'webhook_created'
  | 'webhook_deleted'
  | 'webhook_updated'
  | 'notifications_updated'
  | 'session_revoked'
  | '2fa_enabled'
  | '2fa_disabled'
  | 'regional_settings_updated'
  | 'settings_exported'
  | 'settings_restored';

export interface SettingsBackup {
  id: string;
  user_id: string;
  backup_data: Record<string, any>;
  backup_timestamp: string;
  created_at: string;
}

export interface SettingsRestoreRequest {
  backup_id: string;
}

export interface SettingsRestoreResponse {
  success: boolean;
  restored_fields: string[];
  backup_timestamp: string;
}

// Settings pagination response
export interface PaginatedSettingsResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  has_more: boolean;
}

export default {
  // Types
};
