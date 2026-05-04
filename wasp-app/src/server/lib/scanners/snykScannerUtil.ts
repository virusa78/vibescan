/**
 * Snyk Scanner Utility
 * Executes Snyk CLI and normalizes findings to CycloneDX format
 * 
 * Requires: SNYK_TOKEN environment variable
 * Docs: https://docs.snyk.io/
 */

import { execSync } from 'child_process';
import path from 'path';
import type { ScanResult } from '@prisma/client';

export interface NormalizedFinding {
  cveId: string;
  package: string;
  version: string;
  fixedVersion: string | null;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  cvssScore: number;
  description: string;
  source: string;
}

export interface SnykRawOutput {
  vulnerabilities?: Array<{
    id: string;
    title: string;
    description?: string;
    from: string[];
    package: string;
    version: string;
    fixedIn?: string[];
    cvssScore?: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }>;
  ok?: boolean;
  error?: string;
}

/**
 * Execute Snyk CLI to scan for vulnerabilities
 */
export async function executeSnykScan(targetPath: string, timeout: number = 600000): Promise<SnykRawOutput> {
  try {
    const cmd = `snyk test --json --severity-threshold=low "${targetPath}" 2>&1 || true`;
    const output = execSync(cmd, {
      timeout,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      env: {
        ...process.env,
        SNYK_TOKEN: process.env.SNYK_TOKEN || '',
      },
    });

    const result = JSON.parse(output) as SnykRawOutput;
    return result;
  } catch (error) {
    console.error('[Snyk] Scan execution failed:', error);
    throw new Error(`Snyk scan failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Normalize Snyk findings to unified CycloneDX format
 */
export function normalizeSnykFindings(rawOutput: SnykRawOutput): NormalizedFinding[] {
  if (!rawOutput.vulnerabilities || rawOutput.vulnerabilities.length === 0) {
    return [];
  }

  return rawOutput.vulnerabilities.map((vuln) => ({
    cveId: vuln.id,
    package: vuln.package,
    version: vuln.version,
    fixedVersion: vuln.fixedIn?.[0] || null,
    severity: mapSnykSeverity(vuln.severity),
    cvssScore: vuln.cvssScore || 0,
    description: vuln.description || vuln.title,
    source: 'snyk',
  }));
}

/**
 * Map Snyk severity to standard severity scale
 */
function mapSnykSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' | 'info' {
  const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low' | 'info'> = {
    critical: 'critical',
    high: 'high',
    medium: 'medium',
    low: 'low',
    info: 'info',
  };

  return severityMap[severity] || 'info';
}

/**
 * Format Snyk raw output for database storage
 */
export function formatSnykForDatabase(rawOutput: SnykRawOutput): Record<string, unknown> {
  return {
    vulnerabilities: rawOutput.vulnerabilities || [],
    totalVulnerabilities: rawOutput.vulnerabilities?.length || 0,
    ok: rawOutput.ok || false,
    scannedAt: new Date().toISOString(),
  };
}
