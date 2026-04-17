'use client';

import type { ScanSummary } from './apiClient';

export interface RandomMockScan extends ScanSummary {
  cvePreview: string[];
}

const STORAGE_KEY = 'vs_random_mock_scans_v1';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomCve(year: number = 2026): string {
  return `CVE-${year}-${randomInt(1000, 99999)}`;
}

function createRandomScan(index: number): RandomMockScan {
  const cveCount = randomInt(3, 7);
  const cves = Array.from({ length: cveCount }, () => randomCve());
  const criticalCount = randomInt(0, Math.min(3, cveCount));
  const freeVulns = randomInt(cveCount, cveCount + 6);
  const enterpriseVulns = freeVulns + randomInt(1, 8);

  return {
    id: `mock-${Date.now()}-${index}`,
    label: `mock-random-scan-${index + 1}`,
    inputType: 'sbom_upload',
    repo: 'mock/local-sbom',
    ref: `run@${Date.now().toString().slice(-6)}`,
    status: 'done',
    planAtSubmission: index % 2 === 0 ? 'pro' : 'enterprise',
    freeVulns,
    enterpriseVulns,
    deltaCount: enterpriseVulns - freeVulns,
    criticalCount,
    duration: `${randomInt(45, 180)}s`,
    submittedAt: new Date().toLocaleString(),
    locked: false,
    cvePreview: cves.slice(0, 3),
  };
}

export function getOrCreateRandomMockScans(): RandomMockScan[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      if (Array.isArray(parsed) && parsed.length >= 2) {
        return parsed as RandomMockScan[];
      }
    } catch {
      // Regenerate on parse errors.
    }
  }

  const generated = [createRandomScan(0), createRandomScan(1)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(generated));
  return generated;
}
