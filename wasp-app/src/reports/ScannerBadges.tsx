/**
 * Scanner badges component for displaying which scanners found a CVE
 * Shows colored badges for each scanner with count and external links
 */

import { Badge } from '../client/components/ui/badge';
import { Link as ExternalLink } from '../client/components/common/VibeUI';
import { getScannerConfig } from '../client/utils/scannerColors';

interface ScannerBadgesProps {
  cveId: string;
  reportedBy?: string[];
  _count?: number; // Reserved for future use (multi-scan aggregation)
}

// Backwards-compatible mapping for ScannerBadges: add dbUrl and hover classes here
const LOCAL_DB_URL = (cveId: string) => `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`;

function getLocalConfig(scanner: string) {
  const cfg = getScannerConfig(scanner);

  const dbUrl = scanner === 'snyk'
    ? (cveId: string) => `https://snyk.io/vulnerability/${encodeURIComponent(cveId)}`
    : (cveId: string) => LOCAL_DB_URL(cveId);

  return {
    ...cfg,
    dbUrl,
  };
}

function getFallbackConfig(scanner: string) {
  return {
    letter: scanner.charAt(0).toUpperCase(),
    fullName: scanner,
    bgColor: 'bg-slate-600',
    textColor: 'text-white',
    borderColor: 'border-slate-700',
    hoverBg: 'hover:bg-slate-700',
    dbUrl: (cveId: string) => LOCAL_DB_URL(cveId),
  };
}

export function ScannerBadges({ cveId, reportedBy = [], _count }: ScannerBadgesProps) {
  if (reportedBy.length === 0) {
    return null;
  }

  const uniqueScanners = Array.from(new Set(reportedBy)).sort();
  const scannerCount = uniqueScanners.length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {scannerCount > 1 && (
        <Badge variant="secondary" className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
          {scannerCount} scanners
        </Badge>
      )}

      {uniqueScanners.map((scanner) => {
        const config = getLocalConfig(scanner) ?? getFallbackConfig(scanner);

        return (
          <div
            key={scanner}
            className="group relative"
            title={`Found by ${config.fullName}`}
          >
            {/* Badge button linking to CVE database */}
            <a
              href={config.dbUrl(cveId)}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                inline-flex items-center justify-center
                w-9 h-9 md:w-10 md:h-10
                rounded-lg font-bold text-sm md:text-base
                border-2 ${config.borderColor}
                ${config.bgColor} ${config.textColor}
                ${config.hoverBg ?? ''}
                transition-all duration-200
                shadow-md hover:shadow-lg
                focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-foreground
              `}
              aria-label={`View ${cveId} on ${config.fullName}`}
            >
              {config.letter}
            </a>

            {/* Tooltip on hover */}
            <div
              className="
                absolute bottom-full left-1/2 -translate-x-1/2 mb-2
                invisible group-hover:visible group-focus-within:visible
                bg-foreground text-background
                px-2 py-1 rounded text-xs font-medium whitespace-nowrap
                z-10 pointer-events-none
              "
            >
              {config.fullName}
            </div>
          </div>
        );
      })}

      <CVEDatabaseLink cveId={cveId} />
    </div>
  );
}

/**
 * External CVE database links with search capability
 */
function CVEDatabaseLink({ cveId }: { cveId: string }) {
  const cveLinks = [
    {
      name: 'NVD',
      url: `https://nvd.nist.gov/vuln/detail/${encodeURIComponent(cveId)}`,
      icon: '📋',
    },
    {
      name: 'CVE.org',
      url: `https://www.cve.org/CVERecord?id=${encodeURIComponent(cveId)}`,
      icon: '🔍',
    },
    {
      name: 'GitHub',
      url: `https://github.com/advisories?query=${encodeURIComponent(cveId)}`,
      icon: '⚙️',
    },
  ];

  return (
    <div className="relative group">
      {/* Info icon */}
      <button
        className="
          inline-flex items-center justify-center
          w-9 h-9 md:w-10 md:h-10
          rounded-lg font-bold text-sm md:text-base
          border-2 border-slate-300 bg-slate-100 text-slate-700
          hover:bg-slate-200
          transition-all duration-200
          shadow-md hover:shadow-lg
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background focus:ring-foreground
        "
        title="View CVE details"
        aria-label="View CVE details in external databases"
        tabIndex={0}
      >
        ℹ️
      </button>

      {/* Dropdown menu */}
      <div
        className="
          absolute right-0 mt-1 w-40
          invisible group-hover:visible
          bg-popover border border-border rounded-lg shadow-lg
          z-10
          overflow-hidden
        "
      >
        <div className="p-2 space-y-1">
          {cveLinks.map((link) => (
            <ExternalLink
              key={link.name}
              href={link.url}
              className="
                flex items-center gap-2 px-3 py-2
                rounded hover:bg-accent
                text-xs font-medium text-foreground
                transition-colors
              "
              aria-label={`View ${cveId} on ${link.name}`}
            >
              <span>{link.icon}</span>
              <span>{link.name}</span>
            </ExternalLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ScannerBadges;
