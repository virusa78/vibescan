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
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/35',
    textColor: 'text-emerald-800 dark:text-emerald-200',
    borderColor: 'border-emerald-500/40 dark:border-emerald-400/40',
    hoverBg: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/45',
  },
  snyk: {
    letter: 'S',
    fullName: 'Snyk',
    bgColor: 'bg-violet-50 dark:bg-violet-950/35',
    textColor: 'text-violet-800 dark:text-violet-200',
    borderColor: 'border-violet-500/40 dark:border-violet-400/40',
    hoverBg: 'hover:bg-violet-100 dark:hover:bg-violet-900/45',
  },
  codescoring_johnny: {
    letter: 'C',
    fullName: 'Johnny',
    bgColor: 'bg-sky-50 dark:bg-sky-950/35',
    textColor: 'text-sky-800 dark:text-sky-200',
    borderColor: 'border-sky-500/40 dark:border-sky-400/40',
    hoverBg: 'hover:bg-sky-100 dark:hover:bg-sky-900/45',
  },
  trivy: {
    letter: 'T',
    fullName: 'Trivy',
    bgColor: 'bg-cyan-50 dark:bg-cyan-950/35',
    textColor: 'text-cyan-800 dark:text-cyan-200',
    borderColor: 'border-cyan-500/40 dark:border-cyan-400/40',
    hoverBg: 'hover:bg-cyan-100 dark:hover:bg-cyan-900/45',
  },
  owasp: {
    letter: 'O',
    fullName: 'OWASP',
    bgColor: 'bg-orange-50 dark:bg-orange-950/35',
    textColor: 'text-orange-800 dark:text-orange-200',
    borderColor: 'border-orange-500/40 dark:border-orange-400/40',
    hoverBg: 'hover:bg-orange-100 dark:hover:bg-orange-900/45',
  },
  dast: {
    letter: 'D',
    fullName: 'DAST',
    bgColor: 'bg-rose-50 dark:bg-rose-950/35',
    textColor: 'text-rose-800 dark:text-rose-200',
    borderColor: 'border-rose-500/40 dark:border-rose-400/40',
    hoverBg: 'hover:bg-rose-100 dark:hover:bg-rose-900/45',
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
  return `${c.borderColor} ${c.bgColor}`;
}

export function getScannerLetter(scanner: ScannerKey) {
  return getScannerConfig(scanner).letter;
}

export function getScannerFullName(scanner: ScannerKey) {
  return getScannerConfig(scanner).fullName;
}

export function getScannerSelectionAriaLabel({
  scanner,
  selected,
}: {
  scanner: ScannerKey;
  selected: boolean;
}): string {
  const verb = selected ? 'Deselect' : 'Select';
  return `${verb} ${getScannerFullName(scanner)} scanner`;
}
