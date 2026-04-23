import type { NormalizedComponent } from './inputAdapterService.js';
import { fromCycloneDX, type IngestionErrorType, type IngestionResult, type SeverityLevel, type UnifiedScanPayload } from '../../ingestion/cyclonedx-contracts.js';

export type CycloneDxPipelineMode = 'legacy' | 'shadow' | 'cutover' | 'rollback';

export interface ScannerFindingInput {
  cveId: string;
  severity: string;
  package: string;
  version: string;
  fixedVersion?: string;
  description?: string;
  cvssScore?: number;
}

export interface CycloneDxComponentDecision {
  mode: CycloneDxPipelineMode;
  selectedComponents: NormalizedComponent[];
  ingestionResult: IngestionResult | null;
  telemetry: CycloneDxTelemetry;
}

export interface CycloneDxScanResultDecision {
  mode: CycloneDxPipelineMode;
  ingestionResult: IngestionResult;
  telemetry: CycloneDxTelemetry;
}

export interface CycloneDxTelemetry {
  scanId: string;
  scannerId: string;
  mode: CycloneDxPipelineMode;
  stage: 'components' | 'scan_result';
  status: 'skipped' | 'ingested' | 'rejected';
  processingMs: number;
  errorType?: IngestionErrorType;
  errorCode?: string;
  drift?: {
    legacyComponents: number;
    unifiedComponents: number;
    missingInUnified: number;
    extraInUnified: number;
  };
  unifiedStats?: {
    components: number;
    vulnerabilities: number;
    severity: Partial<Record<SeverityLevel, number>>;
  };
}

function envFlag(value: string | undefined, defaultValue = false): boolean {
  if (value == null) return defaultValue;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

export function resolveCycloneDxPipelineMode(): CycloneDxPipelineMode {
  if (envFlag(process.env.VIBESCAN_CYCLONEDX_ROLLBACK_ENABLED)) {
    return 'rollback';
  }
  if (envFlag(process.env.VIBESCAN_CYCLONEDX_CUTOVER_ENABLED)) {
    return 'cutover';
  }
  if (envFlag(process.env.VIBESCAN_CYCLONEDX_SHADOW_ENABLED)) {
    return 'shadow';
  }
  return 'legacy';
}

function componentKey(component: NormalizedComponent): string {
  const name = component.name.trim();
  const version = component.version.trim();
  const purl = component.purl?.trim();
  return purl || `${name}@${version}`;
}

function toNormalizedComponents(payload: UnifiedScanPayload): NormalizedComponent[] {
  return payload.components
    .map((component) => ({
      name: component.name,
      version: component.version,
      purl: component.purl,
      type: component.type,
    }))
    .filter((component) => component.name && component.version && component.version !== 'unknown');
}

function computeDrift(legacy: NormalizedComponent[], unified: NormalizedComponent[]) {
  const legacySet = new Set(legacy.map(componentKey));
  const unifiedSet = new Set(unified.map(componentKey));

  let missingInUnified = 0;
  for (const key of legacySet) {
    if (!unifiedSet.has(key)) missingInUnified += 1;
  }

  let extraInUnified = 0;
  for (const key of unifiedSet) {
    if (!legacySet.has(key)) extraInUnified += 1;
  }

  return {
    legacyComponents: legacy.length,
    unifiedComponents: unified.length,
    missingInUnified,
    extraInUnified,
  };
}

function safeSeverity(level: string): SeverityLevel {
  const normalized = level.trim().toLowerCase();
  if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low' || normalized === 'info') {
    return normalized;
  }
  return 'info';
}

function pickBomRef(component: NormalizedComponent): string {
  return component.purl?.trim() || `${component.name}@${component.version}`;
}

function buildCycloneDxFromFindings(
  scannerId: string,
  components: NormalizedComponent[],
  findings: ScannerFindingInput[],
): Record<string, unknown> {
  const componentDocs = components.map((component) => ({
    'bom-ref': pickBomRef(component),
    type: component.type || 'library',
    name: component.name,
    version: component.version,
    purl: component.purl,
  }));

  const componentRefs = new Map<string, string>();
  for (const component of components) {
    componentRefs.set(`${component.name}@${component.version}`, pickBomRef(component));
  }

  const vulnerabilities = findings.map((finding) => {
    const componentRef = componentRefs.get(`${finding.package}@${finding.version}`) || `${finding.package}@${finding.version}`;
    return {
      id: finding.cveId,
      source: { name: scannerId },
      description: finding.description || '',
      ratings: [{ severity: safeSeverity(finding.severity), score: finding.cvssScore ?? 0 }],
      fixes: finding.fixedVersion ? [{ version: finding.fixedVersion }] : [],
      affects: [{ ref: componentRef }],
    };
  });

  return {
    bomFormat: 'CycloneDX',
    specVersion: '1.4',
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: { components: [{ name: scannerId, version: 'vibescan-runtime' }] },
    },
    components: componentDocs,
    vulnerabilities,
  };
}

function buildTelemetry(
  scanId: string,
  scannerId: string,
  mode: CycloneDxPipelineMode,
  stage: CycloneDxTelemetry['stage'],
  result: IngestionResult | null,
  drift?: CycloneDxTelemetry['drift'],
): CycloneDxTelemetry {
  if (!result) {
    return {
      scanId,
      scannerId,
      mode,
      stage,
      status: 'skipped',
      processingMs: 0,
      drift,
    };
  }

  if (result.status === 'ingested') {
    return {
      scanId,
      scannerId,
      mode,
      stage,
      status: 'ingested',
      processingMs: result.processingTimeMs,
      drift,
      unifiedStats: {
        components: result.payload.stats.componentCount,
        vulnerabilities: result.payload.stats.vulnerabilityCount,
        severity: result.payload.stats.severityCounts,
      },
    };
  }

  return {
    scanId,
    scannerId,
    mode,
    stage,
    status: 'rejected',
    processingMs: result.processingTimeMs,
    errorType: result.error.type,
    errorCode: result.error.code,
    drift,
  };
}

export function decideComponentsWithCycloneDx(options: {
  scanId: string;
  scannerId: string;
  sbomRaw?: Record<string, unknown> | null;
  legacyComponents: NormalizedComponent[];
}): CycloneDxComponentDecision {
  const mode = resolveCycloneDxPipelineMode();
  const { scanId, scannerId, sbomRaw, legacyComponents } = options;

  if (!sbomRaw || mode === 'legacy' || mode === 'rollback') {
    return {
      mode,
      selectedComponents: legacyComponents,
      ingestionResult: null,
      telemetry: buildTelemetry(scanId, scannerId, mode, 'components', null),
    };
  }

  const ingestionResult = fromCycloneDX(sbomRaw, {
    scanId,
    scannerId,
    stage: 'ingestion',
    source: 'scan_input',
    ingestedAt: new Date(),
  });

  if (ingestionResult.status !== 'ingested') {
    return {
      mode,
      selectedComponents: legacyComponents,
      ingestionResult,
      telemetry: buildTelemetry(scanId, scannerId, mode, 'components', ingestionResult),
    };
  }

  const unifiedComponents = toNormalizedComponents(ingestionResult.payload);
  const drift = computeDrift(legacyComponents, unifiedComponents);
  const telemetry = buildTelemetry(scanId, scannerId, mode, 'components', ingestionResult, drift);

  return {
    mode,
    selectedComponents: mode === 'cutover' ? unifiedComponents : legacyComponents,
    ingestionResult,
    telemetry,
  };
}

export function ingestScannerFindingsWithCycloneDx(options: {
  scanId: string;
  scannerId: string;
  components: NormalizedComponent[];
  findings: ScannerFindingInput[];
}): CycloneDxScanResultDecision {
  const mode = resolveCycloneDxPipelineMode();
  const { scanId, scannerId, components, findings } = options;

  const document = buildCycloneDxFromFindings(scannerId, components, findings);
  const ingestionResult = fromCycloneDX(document, {
    scanId,
    scannerId,
    stage: 'ingestion',
    source: 'scanner_result',
    ingestedAt: new Date(),
  });

  return {
    mode,
    ingestionResult,
    telemetry: buildTelemetry(scanId, scannerId, mode, 'scan_result', ingestionResult),
  };
}

export function logCycloneDxTelemetry(telemetry: CycloneDxTelemetry): void {
  console.log('[CycloneDXIngestion]', JSON.stringify(telemetry));
}
