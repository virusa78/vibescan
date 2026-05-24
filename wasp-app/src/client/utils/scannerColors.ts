// Centralized scanner color configuration and helpers

export type ScannerKey = string;

export const SCANNER_CONFIG: Record<string, {
  letter: string;
  fullName: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
  hoverBg?: string;
}> = {
  grype: {
    letter: 'G',
    fullName: 'Grype',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    borderColor: 'border-emerald-500/30',
    hoverBg: 'hover:bg-emerald-100',
  },
  snyk: {
    letter: 'S',
    fullName: 'Snyk',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-700',
    borderColor: 'border-violet-500/30',
    hoverBg: 'hover:bg-violet-100',
  },
  codescoring_johnny: {
    letter: 'C',
    fullName: 'Johnny',
    bgColor: 'bg-sky-50',
    textColor: 'text-sky-700',
    borderColor: 'border-sky-500/30',
    hoverBg: 'hover:bg-sky-100',
  },
  trivy: {
    letter: 'T',
    fullName: 'Trivy',
    bgColor: 'bg-cyan-50',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-500/30',
    hoverBg: 'hover:bg-cyan-100',
  },
  owasp: {
    letter: 'O',
    fullName: 'OWASP',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    borderColor: 'border-orange-500/30',
    hoverBg: 'hover:bg-orange-100',
  },
  dast: {
    letter: 'D',
    fullName: 'DAST',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-700',
    borderColor: 'border-rose-500/30',
    hoverBg: 'hover:bg-rose-100',
  },
};

const DEFAULT = {
  letter: '?',
  fullName: 'Unknown',
  bgColor: 'bg-slate-100',
  textColor: 'text-slate-700',
  borderColor: 'border-slate-300',
  hoverBg: 'hover:bg-slate-200',
};

export function getScannerConfig(scanner: ScannerKey) {
  return SCANNER_CONFIG[scanner] ?? DEFAULT;
}

export function getScannerBadgeClass(scanner: ScannerKey) {
  const c = getScannerConfig(scanner);
  return `${c.borderColor} ${c.bgColor} ${c.textColor}`;
}

export function getScannerCardClass(scanner: ScannerKey) {
  const c = getScannerConfig(scanner);
  // card classes for a neutral card background with subtle colored border
  return `${c.borderColor} ${c.bgColor} ${c.textColor}`;
}

export function getScannerDotClass(scanner: ScannerKey) {
  const c = getScannerConfig(scanner);
  // small dot color (background)
  return `${c.bgColor} ${c.textColor}`;
}

export function getScannerLetter(scanner: ScannerKey) {
  return getScannerConfig(scanner).letter;
}

export function getScannerFullName(scanner: ScannerKey) {
  return getScannerConfig(scanner).fullName;
}
