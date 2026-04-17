'use client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;

  const tokenBundle = localStorage.getItem('vibescan_tokens');
  if (tokenBundle) {
    try {
      const parsed = JSON.parse(tokenBundle);
      if (parsed?.accessToken) return parsed.accessToken as string;
      if (parsed?.access_token) return parsed.access_token as string;
    } catch {
      // Ignore malformed token cache.
    }
  }

  return localStorage.getItem('auth_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error('Not authenticated');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  if (options.headers && typeof options.headers === 'object' && !Array.isArray(options.headers)) {
    Object.assign(headers, options.headers as Record<string, string>);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const body = await response.json();
      const validationMessage = Array.isArray(body?.validation_errors)
        ? body.validation_errors[0]?.message
        : undefined;
      message =
        body?.message ||
        body?.error?.message ||
        validationMessage ||
        (typeof body?.error === 'string' ? body.error : undefined) ||
        message;
    } catch {
      // Use default message.
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json();
  return (payload?.data ?? payload) as T;
}

export interface SettingsApiKey {
  id: string;
  key_prefix: string;
  label: string;
  scopes: string[];
  created_at: string;
  last_used_at?: string;
  expires_at?: string;
  revoked_at?: string;
}

export interface CreateSettingsApiKeyResponse {
  raw_key: string;
  key_id: string;
  message: string;
}

export interface SettingsWebhook {
  id: string;
  user_id: string;
  url: string;
  enabled: boolean;
  created_at: string;
  updated_at?: string;
  last_delivery_status?: string;
}

export interface PlanInfo {
  current_plan: string;
  monthly_limit: number;
  scans_used: number;
  remaining: number;
  usage_percentage: number;
  warning_flag: boolean;
  reset_at: string;
  next_billing_date?: string;
  trial_end_date?: string | null;
}

export interface SubscriptionInfo {
  plan?: string;
  status?: string;
  current_period_end?: string;
  cancel_at_period_end?: boolean;
  [key: string]: unknown;
}

export interface CurrentUserInfo {
  id: string;
  email: string;
  name?: string;
  plan?: string;
  region?: 'IN' | 'PK' | 'OTHER' | string;
}

export interface SecurityInfo {
  sessions: Array<{
    id?: string;
    userAgent?: string;
    createdAt?: string;
    ip?: string;
    device_info?: string;
    created_at?: string;
    ip_address?: string;
  }>;
}

export interface SecurityEventsResponse {
  items: Array<{ id?: string; event_type?: string; created_at?: string; metadata?: Record<string, unknown> }>;
}

export const settingsApi = {
  getCurrentUser: () => request<CurrentUserInfo>('/auth/me'),

  listApiKeys: () => request<SettingsApiKey[]>('/settings/api-keys'),
  createApiKey: (payload: { label: string; scopes: string[]; expires_at?: string }) =>
    request<CreateSettingsApiKeyResponse>('/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  revokeApiKey: (id: string) =>
    request<void>(`/settings/api-keys/${id}`, { method: 'DELETE' }),

  listWebhooks: () => request<SettingsWebhook[]>('/settings/webhooks'),
  createWebhook: (payload: { url: string; enabled?: boolean }) =>
    request<SettingsWebhook>('/settings/webhooks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateWebhook: (id: string, payload: { url?: string; enabled?: boolean }) =>
    request<SettingsWebhook>(`/settings/webhooks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteWebhook: (id: string) =>
    request<void>(`/settings/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id: string) =>
    request<{ status: string }>(`/settings/webhooks/${id}/test`, { method: 'POST' }),

  getPlan: () => request<PlanInfo>('/settings/plan'),
  getPlanHistory: () => request<{ items: Array<Record<string, unknown>> }>('/settings/plan/history'),
  getSubscription: () => request<SubscriptionInfo>('/billing/subscription'),
  cancelSubscription: (immediately = false) =>
    request<{ message: string }>('/billing/cancel', {
      method: 'POST',
      body: JSON.stringify({ immediately }),
    }),
  createCheckoutSession: (plan: string, region: 'IN' | 'PK' | 'OTHER') =>
    request<{ checkoutUrl?: string; url?: string }>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ plan, region }),
    }),

  getSecurity: () => request<SecurityInfo>('/settings/security'),
  getSecurityEvents: () => request<SecurityEventsResponse>('/settings/security/events'),
  revokeSession: (sessionId: string) =>
    request<void>(`/settings/security/revoke-session/${sessionId}`, { method: 'POST' }),
};
