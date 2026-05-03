/**
 * VibeScan Data Fetching Hooks
 *
 * Custom React hooks for interacting with the VibeScan API.
 * Uses SWR for data fetching and caching.
 */

import useSWR from 'swr';
import { apiClient, mapApiScanToUiScan } from './apiClient';
import type { ApiScanSummary, DashboardSummary, Scan, ScanSummary } from './apiClient';
import { clearAuthClient, getAccessTokenClient } from './auth';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Fetcher for SWR
const fetcher = async (url: string) => {
  const headers: Record<string, string> = {};
  if (typeof window !== 'undefined') {
    const token = getAccessTokenClient();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(`${API_BASE_URL}${url}`, { headers });
  if (response.status === 401 && typeof window !== 'undefined') {
    const redirectParam = window.location.pathname.replace(/^\//, '') || 'dashboard';
    clearAuthClient(`/login?redirect=${encodeURIComponent(redirectParam)}`);
  }
  if (!response.ok) {
    const error = new Error('API Error');
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const body = await response.json();
  return body?.data ?? body;
};

// Auth hooks
export function useLogin() {
  return async (email: string, password: string) => {
    const tokens = await apiClient.login(email, password);
    return tokens;
  };
}

export function useLogout() {
  return async () => {
    await apiClient.logout();
  };
}

export function useAuth() {
  const tokens = typeof window !== 'undefined' ? localStorage.getItem('vibescan_tokens') : null;
  return tokens !== null;
}

// Scans hooks
export function useScans(status?: Scan['status'], inputType?: Scan['input_type'], limit: number = 20, cursor?: string) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (inputType) params.append('input_type', inputType);
  params.append('limit', limit.toString());
  if (cursor) params.append('cursor', cursor);

  const { data, error, mutate } = useSWR(
    `/scans?${params.toString()}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const toUiScan = (scan: Record<string, any>): ScanSummary => {
    if (typeof scan.free_vulns === 'number') {
      return mapApiScanToUiScan(scan as unknown as ApiScanSummary);
    }

    const inputRef = String(scan.input_ref || '');
    const [repo = inputRef, ref = 'HEAD'] = inputRef.includes('@') ? inputRef.split('@') : [inputRef, 'HEAD'];
    const createdAt = scan.created_at ? new Date(scan.created_at) : null;
    const completedAt = scan.completed_at ? new Date(scan.completed_at) : null;
    const duration = createdAt && completedAt
      ? `${Math.max(1, Math.round((completedAt.getTime() - createdAt.getTime()) / 1000))}s`
      : '--';

    const inputTypeMap: Record<string, ScanSummary['inputType']> = {
      github_app: 'github',
      source_zip: 'source_zip',
      sbom_upload: 'sbom_upload',
      ci_plugin: 'source_zip',
    };

    return {
      id: String(scan.id),
      label: inputRef.split('/').pop() || inputRef || String(scan.id),
      inputType: inputTypeMap[String(scan.input_type)] || 'source_zip',
      repo,
      ref,
      status: scan.status,
      planAtSubmission: scan.plan_at_submission || 'starter',
      freeVulns: Number(scan.free_vulns || 0),
      enterpriseVulns: Number(scan.enterprise_vulns || 0),
      deltaCount: Number(scan.delta_count || 0),
      criticalCount: Number(scan.critical_count || 0),
      duration,
      submittedAt: createdAt ? createdAt.toLocaleString() : '--',
      locked: Boolean(scan.locked),
    };
  };

  const uiData = (data?.items || []).map((scan: Record<string, any>) => toUiScan(scan));

  return {
    data: uiData,
    error,
    mutate,
  };
}

export function useScan(scanId: string) {
  const { data, error, mutate } = useSWR(`/scans/${scanId}`, fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 5000, // Refresh every 5 seconds for active scans
  });
  return { data, error, mutate };
}

export function useSubmitScan() {
  return async (type: 'source' | 'sbom' | 'github', data: { file?: File; sbom?: Record<string, unknown>; webhookUrl?: string; meta?: Record<string, unknown>; installationId?: string; repo?: string; ref?: string }) => {
    if (type === 'source') {
      throw new Error('Source ZIP upload is not wired in this UI flow yet.');
    } else if (type === 'sbom' && data.sbom) {
      return apiClient.submitScanSbom(data.sbom, data.webhookUrl, data.meta as { ref?: string; repo?: string; commit_sha?: string } | undefined);
    } else if (type === 'github' && data.repo && data.ref) {
      return apiClient.submitScanGithub(data.installationId || 'ui-manual', data.repo, data.ref);
    }
    throw new Error('Invalid scan payload.');
  };
}

export function useDashboardSummary() {
  const { data, error, mutate, isLoading } = useSWR('/dashboard/summary', fetcher, {
    refreshInterval: 20000,
    revalidateOnFocus: false,
  });

  const raw = data as (Omit<DashboardSummary, 'recentScans'> & {
    recentScans?: Array<ApiScanSummary | ScanSummary | Record<string, unknown>>;
  }) | undefined;

  const toScanSummary = (item: ApiScanSummary | ScanSummary | Record<string, unknown>): ScanSummary => {
    const maybeScan = item as Record<string, unknown>;
    if ('inputType' in maybeScan) {
      return item as ScanSummary;
    }
    return mapApiScanToUiScan(item as ApiScanSummary);
  };

  const normalizedData = raw
    ? {
        ...raw,
        recentScans: (raw.recentScans || []).map((scan) => toScanSummary(scan)),
      }
    : undefined;

  return {
    data: normalizedData as DashboardSummary | undefined,
    error,
    mutate,
    isLoading,
  };
}

export function useCancelScan() {
  return async (scanId: string) => {
    await apiClient.cancelScan(scanId);
  };
}

// Reports hooks
export function useReport(scanId: string, format: 'json' | 'summary' = 'json') {
  const key = scanId ? `/reports/${scanId}?format=${format}` : null;
  const { data, error, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
  });
  return { data, error, mutate };
}

export function useGeneratePdf() {
  return async (scanId: string) => {
    return apiClient.generatePdf(scanId);
  };
}

// Quota hooks
export function useQuotaInfo() {
  const { data, error, mutate } = useSWR('/quota', fetcher, {
    revalidateOnFocus: false,
    refreshInterval: 30000, // Refresh every 30 seconds
  });
  return { data, error, mutate };
}

// API Keys hooks
export function useApiKeys() {
  const { data, error, mutate } = useSWR('/api-keys', fetcher, {
    revalidateOnFocus: false,
  });
  return { data, error, mutate };
}

export function useGenerateApiKey() {
  return async (label: string, scopes: string[], expiresAt?: string) => {
    const result = await apiClient.generateApiKey(label, scopes, expiresAt);
    return result;
  };
}

export function useRevokeApiKey() {
  return async (keyId: string) => {
    await apiClient.revokeApiKey(keyId);
  };
}

// Webhooks hooks
export function useWebhookDeliveries(scanId?: string, status?: string, limit: number = 20) {
  const params = new URLSearchParams();
  if (scanId) params.append('scan_id', scanId);
  if (status) params.append('status', status);
  params.append('limit', limit.toString());

  const { data, error, mutate } = useSWR(`/webhooks/deliveries?${params.toString()}`, fetcher, {
    revalidateOnFocus: false,
  });
  return { data, error, mutate };
}

// Billing hooks
export function useSubscriptionDetails() {
  const { data, error, mutate } = useSWR('/billing/subscription', fetcher, {
    revalidateOnFocus: false,
  });
  return { data, error, mutate };
}

export function useRegionalPricing(region: 'IN' | 'PK' | 'OTHER') {
  const { data, error, mutate } = useSWR(`/billing/regional-pricing?region=${region}`, fetcher, {
    revalidateOnFocus: false,
  });
  return { data, error, mutate };
}
