import { writeFileSync } from 'fs';
import { setTimeout as delay } from 'timers/promises';

export type VibeScanSubmitResponse = {
  id: string;
  status?: string;
  created_at?: string;
  quota_remaining?: number;
};

export type VibeScanScanStatusResponse = {
  status?: string;
  scan?: {
    status?: string;
  };
};

export type VibeScanCIDecisionResponse = {
  scanId: string;
  decision: 'pass' | 'fail';
  reason: string;
  blockingIssues: number;
  blockingIssuesBySource: Record<string, number>;
  effectiveThreshold: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  scanUrl: string;
  reportUrl: string;
  policySource: 'github_installation' | 'default';
};

type CIGateConfig = {
  apiBaseUrl: string;
  apiKey: string;
  repositoryUrl: string;
  pollIntervalMs: number;
  timeoutMs: number;
};

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/$/, '');
}

export function readConfig(): CIGateConfig {
  const apiBaseUrl = normalizeBaseUrl(
    process.env.VIBESCAN_API_BASE_URL?.trim()
      || process.env.WASP_SERVER_URL?.trim()
      || 'https://app.vibescan.app',
  );
  const apiKey = process.env.VIBESCAN_API_KEY?.trim() || '';
  const repositoryUrl = process.env.VIBESCAN_REPOSITORY_URL?.trim() || '';
  const pollIntervalMs = Number.parseInt(process.env.VIBESCAN_POLL_INTERVAL_MS?.trim() || '5000', 10);
  const timeoutMs = Number.parseInt(process.env.VIBESCAN_TIMEOUT_MS?.trim() || String(20 * 60 * 1000), 10);

  if (!apiKey) {
    throw new Error('VIBESCAN_API_KEY is required');
  }

  if (!repositoryUrl) {
    throw new Error('VIBESCAN_REPOSITORY_URL is required');
  }

  return {
    apiBaseUrl,
    apiKey,
    repositoryUrl,
    pollIntervalMs: Number.isFinite(pollIntervalMs) && pollIntervalMs > 0 ? pollIntervalMs : 5000,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20 * 60 * 1000,
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const bodyText = await response.text();
  let payload: T;

  try {
    payload = bodyText.length > 0 ? JSON.parse(bodyText) as T : ({} as T);
  } catch {
    payload = {} as T;
  }

  if (!response.ok) {
    const message = typeof payload === 'object' && payload !== null && 'message' in payload
      ? String((payload as { message?: unknown }).message ?? bodyText)
      : bodyText;
    throw new Error(`Request to ${url} failed (${response.status}): ${message}`);
  }

  return payload;
}

function toExitCode(decision: 'pass' | 'fail'): number {
  return decision === 'pass' ? 0 : 1;
}

function formatSourceBreakdown(blockingIssuesBySource: Record<string, number>): string {
  const entries = Object.entries(blockingIssuesBySource);
  if (entries.length === 0) {
    return 'none';
  }

  return entries.map(([source, count]) => `${source}=${count}`).join(', ');
}

async function submitScan(config: CIGateConfig): Promise<string> {
  const response = await requestJson<VibeScanSubmitResponse>(`${config.apiBaseUrl}/api/v1/scans`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      inputType: 'github',
      inputRef: config.repositoryUrl,
    }),
  });

  if (!response.id) {
    throw new Error('VibeScan scan submission did not return a scan id');
  }

  return response.id;
}

async function pollForScanCompletion(config: CIGateConfig, scanId: string): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < config.timeoutMs) {
    const response = await requestJson<VibeScanScanStatusResponse>(
      `${config.apiBaseUrl}/api/v1/scans/${scanId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      },
    );

    const status = String(response.scan?.status ?? response.status ?? '').toLowerCase();
    if (status === 'done') {
      return;
    }

    if (status === 'error' || status === 'cancelled') {
      throw new Error(`VibeScan scan ${scanId} finished with status ${status}`);
    }

    await delay(config.pollIntervalMs);
  }

  throw new Error(`Timed out waiting for VibeScan scan ${scanId} to complete`);
}

async function fetchCiDecision(config: CIGateConfig, scanId: string): Promise<VibeScanCIDecisionResponse> {
  return requestJson<VibeScanCIDecisionResponse>(`${config.apiBaseUrl}/api/v1/reports/${scanId}/ci-decision`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      Accept: 'application/json',
    },
  });
}

function appendStepSummary(lines: string[]): void {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY?.trim();
  if (!summaryPath) {
    return;
  }

  writeFileSync(summaryPath, `${lines.join('\n')}\n`, { flag: 'a' });
}

function printDecisionSummary(decision: VibeScanCIDecisionResponse): void {
  const lines = [
    '## VibeScan CI Gate',
    '',
    `- Decision: **${decision.decision.toUpperCase()}**`,
    `- Threshold: \`${decision.effectiveThreshold}\` (${decision.policySource})`,
    `- Blocking issues: ${decision.blockingIssues}`,
    `- Blocking by source: ${formatSourceBreakdown(decision.blockingIssuesBySource)}`,
    `- Scan: ${decision.scanUrl}`,
    `- Report: ${decision.reportUrl}`,
    '',
    decision.reason,
  ];

  appendStepSummary(lines);
  console.log(lines.join('\n'));
}

export async function runVibeScanCIGate(config: CIGateConfig): Promise<number> {
  const scanId = await submitScan(config);
  await pollForScanCompletion(config, scanId);
  const decision = await fetchCiDecision(config, scanId);
  printDecisionSummary(decision);
  return toExitCode(decision.decision);
}

export { toExitCode };
