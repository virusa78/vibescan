export type ScannerSource = 'grype' | 'trivy' | 'codescoring_johnny' | 'owasp' | 'snyk';

export type ScannerAccessPreview = {
  snyk_enabled?: boolean;
  snyk_ready?: boolean;
  snyk_credential_source?: 'environment' | 'user-secret' | null;
};

export type ScannerLineupEntry = {
  source: ScannerSource;
  label: string;
  description: string;
  badgeClassName: string;
};

const SCANNER_LINEUP: Record<ScannerSource, ScannerLineupEntry> = {
  grype: {
    source: 'grype',
    label: 'Grype',
    description: 'Free lane for dependency vulnerabilities.',
    badgeClassName: 'border-sky-500/30 bg-sky-500/10 text-sky-700',
  },
  trivy: {
    source: 'trivy',
    label: 'Trivy',
    description: 'Free SBOM lane for CycloneDX imports and package analysis.',
    badgeClassName: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700',
  },
  codescoring_johnny: {
    source: 'codescoring_johnny',
    label: 'Johnny',
    description: 'Enterprise lane with monthly usage policy.',
    badgeClassName: 'border-violet-500/30 bg-violet-500/10 text-violet-700',
  },
  owasp: {
    source: 'owasp',
    label: 'OWASP',
    description: 'External DAST import lane.',
    badgeClassName: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700',
  },
  snyk: {
    source: 'snyk',
    label: 'Snyk',
    description: 'Runs with a user-owned key or environment token.',
    badgeClassName: 'border-rose-500/30 bg-rose-500/10 text-rose-700',
  },
};

export function getScannerLineupEntry(source: string): ScannerLineupEntry {
  const normalized = source as ScannerSource;
  return SCANNER_LINEUP[normalized] ?? {
    source: normalized,
    label: source,
    description: 'Scanner lane',
    badgeClassName: 'border-slate-500/30 bg-slate-500/10 text-slate-700',
  };
}

export function getPlannedScannerSources(access?: ScannerAccessPreview | null): ScannerSource[] {
  const sources: ScannerSource[] = ['grype', 'trivy', 'codescoring_johnny', 'owasp'];

  if (access?.snyk_enabled && access.snyk_ready && access.snyk_credential_source) {
    sources.push('snyk');
  }

  return sources;
}
