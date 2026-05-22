import type { Prisma } from '@prisma/client';
import { getScannerProvider } from '../lib/scanners/scannerProviderRegistry.js';
import type { ScannerExecutionContext } from '../lib/scanners/providerTypes.js';
import { loadScanArtifacts, type NormalizedComponent } from './inputAdapterService.js';
import type { PersistedGitHubScanContext } from './githubAppService';
import { syncGitHubCheckRunForScan } from './githubCheckRunService.js';
import {
  buildCycloneDxIngestionMeta,
  decideComponentsWithCycloneDx,
  ingestScannerFindingsWithCycloneDx,
  logCycloneDxTelemetry,
} from './cyclonedxIngestionService.js';
import { persistCycloneDxRolloutSnapshot } from './cyclonedxRolloutGovernance.js';
import { captureCycloneDxArtifacts } from './cyclonedxArtifactStorage.js';
import { finalizeScanIfReady, handleScannerFailure } from './scanLifecycleService.js';
import { resolveCredentialsForProvider } from './scannerCredentialResolver.js';
import { persistNormalizedFindingsForScan } from './findingPersistenceService.js';
import type {
  ScannerExecutionRequest,
  ScannerExecutionResult,
} from './scannerExecutionTypes.js';

type ScanRecord = {
  id: string;
  inputType: string;
  inputRef: string;
  githubContext: unknown;
  components: unknown;
  sbomRaw: unknown;
};

type CycloneDxScannerId = 'free' | 'enterprise';

function toCycloneDxScannerId(providerKind: ScannerExecutionRequest['providerKind']): CycloneDxScannerId {
  return providerKind === 'grype' || providerKind === 'trivy' ? 'free' : 'enterprise';
}

function toNormalizedComponents(value: unknown): NormalizedComponent[] {
  return Array.isArray(value) ? (value as NormalizedComponent[]) : [];
}

function toSbomRaw(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function toGitHubContext(value: unknown): PersistedGitHubScanContext | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as PersistedGitHubScanContext)
    : null;
}

function formatHealthSnapshot(
  health: { configured: boolean; healthy: boolean | null; message?: string | null },
): string {
  return `configured=${health.configured} healthy=${health.healthy ?? 'null'}${health.message ? ` message="${health.message}"` : ''}`;
}

async function loadScanForExecution(
  prisma: ScannerExecutionRequest['prisma'],
  scanId: string,
): Promise<ScanRecord | null> {
  return prisma.scan.findUnique({
    where: { id: scanId },
    select: {
      id: true,
      inputType: true,
      inputRef: true,
      githubContext: true,
      components: true,
      sbomRaw: true,
    },
  });
}

async function ensureScanStarted(
  prisma: ScannerExecutionRequest['prisma'],
  scanId: string,
  loggerLabel: string,
): Promise<boolean> {
  // Check if scan exists and is still in a valid state for processing
  const scan = await prisma.scan.findUnique({
    where: { id: scanId },
    select: { id: true, status: true },
  });

  if (!scan) {
    console.log(`[${loggerLabel}] Scan ${scanId} not found, skipping`);
    return false;
  }

  // Allow scans in 'pending', 'scanning', or 'error' status (error means one scanner failed but others may still run)
  if (scan.status === 'done' || scan.status === 'cancelled') {
    console.log(`[${loggerLabel}] Scan ${scanId} is no longer active (status: ${scan.status}), skipping`);
    return false;
  }

  // Transition from pending to scanning (if needed)
  if (scan.status === 'pending') {
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'scanning' },
    });
  }
  // If status is already 'scanning' or 'error', allow this scanner to proceed
  // (error means one scanner failed, but other scanners should still be able to run)

  return true;
}

async function hydrateScanArtifacts(
  prisma: ScannerExecutionRequest['prisma'],
  scan: ScanRecord,
): Promise<{
  components: NormalizedComponent[];
  sbomRaw: Record<string, unknown> | null;
}> {
  let hydratedComponents = toNormalizedComponents(scan.components);
  let hydratedSbomRaw = toSbomRaw(scan.sbomRaw);

  if (hydratedComponents.length === 0) {
    const githubContext = toGitHubContext(scan.githubContext);
    const hydrated = await loadScanArtifacts(scan.inputType, scan.inputRef, {
      githubContext,
    });
    hydratedComponents = hydrated.components;
    hydratedSbomRaw = toSbomRaw(hydrated.sbomRaw) ?? hydratedSbomRaw;

    await prisma.scan.update({
      where: { id: scan.id },
      data: {
        components: hydratedComponents as unknown as Prisma.InputJsonValue,
        sbomRaw: hydrated.sbomRaw as Prisma.InputJsonValue,
      },
    });
  }

  return {
    components: hydratedComponents,
    sbomRaw: hydratedSbomRaw,
  };
}

export async function executeScannerForScan(
  input: ScannerExecutionRequest,
): Promise<ScannerExecutionResult> {
  const { prisma, scanId, userId, source, providerKind, loggerLabel } = input;
  const scannerId = toCycloneDxScannerId(providerKind);
  const provider = getScannerProvider(providerKind);
  const isOwaspScan = providerKind === 'owasp';

  const isUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
  if (!isUuid(scanId)) {
    console.error(`[${loggerLabel}] Invalid scanId format: ${scanId}`);
    return {
      status: 'skipped',
      findingsCount: 0,
      scanResultId: null,
    };
  }

  try {
    console.log(`[${loggerLabel}] Starting scan ${scanId} for user ${userId} via provider ${providerKind}`);
    if (isOwaspScan) {
      console.log(`[${loggerLabel}] OWASP execution entered the worker pipeline`);
    }

    const started = await ensureScanStarted(prisma, scanId, loggerLabel);
    if (!started) {
      if (isOwaspScan) {
        console.log(`[${loggerLabel}] OWASP skipped before scan start gate`);
      }
      return {
        status: 'skipped',
        findingsCount: 0,
        scanResultId: null,
      };
    }

    await syncGitHubCheckRunForScan({
      prisma: prisma as any,
      scanId,
      status: 'in_progress',
    });

    const scan = await loadScanForExecution(prisma, scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }
    const githubContext = toGitHubContext(scan.githubContext);
    if (isOwaspScan) {
      console.log(`[${loggerLabel}] OWASP scan payload loaded`, {
        inputType: scan.inputType,
        inputRef: scan.inputRef,
        hasGithubContext: Boolean(githubContext),
      });
    }

    const hydrated = await hydrateScanArtifacts(prisma, scan);
    if (hydrated.components.length === 0) {
      console.log(`[${loggerLabel}] No components to scan for ${scanId}`);
    }
    if (isOwaspScan) {
      console.log(`[${loggerLabel}] OWASP hydration complete`, {
        components: hydrated.components.length,
        hasSbomRaw: Boolean(hydrated.sbomRaw),
      });
    }

    const componentDecision = decideComponentsWithCycloneDx({
      scanId,
      scannerId,
      sbomRaw: hydrated.sbomRaw,
      legacyComponents: hydrated.components,
    });
    logCycloneDxTelemetry(componentDecision.telemetry);

    const scannerComponents = componentDecision.selectedComponents;
    const executionContext: ScannerExecutionContext = {
      scanId,
      userId,
      inputType: scan.inputType as ScannerExecutionContext['inputType'],
      inputRef: scan.inputRef,
      credentialSource: input.credentialSource,
      resolvedCredentials: await resolveCredentialsForProvider(
        prisma,
        providerKind,
        input.credentialSource,
      ),
      githubContext,
    };

    let providerRun: any;
    const health = await provider.getHealth(executionContext);
    console.log(
      `[${loggerLabel}] Provider ${providerKind} health for scan ${scanId}: ${formatHealthSnapshot(health)}`,
    );
    if (isOwaspScan) {
      console.log(`[${loggerLabel}] OWASP health check result`, health);
    }
    if (!health.configured || health.healthy === false) {
      console.warn(
        `[${loggerLabel}] Skipping provider ${providerKind} for scan ${scanId} because it is unavailable: ${formatHealthSnapshot(health)}`,
      );
      if (isOwaspScan) {
        console.warn(`[${loggerLabel}] OWASP skipped before execution because health was not ready`);
      }
      providerRun = {
        provider: provider.kind,
        rawOutput: { 
          error: health.message || `${provider.displayName} is not healthy or not configured`,
          failed: true,
          unconfigured: !health.configured,
          failedAt: new Date().toISOString()
        },
        findings: [],
        durationMs: 0,
      };
    } else {
      try {
        if (isOwaspScan) {
          console.log(`[${loggerLabel}] OWASP execution starting`, {
            components: scannerComponents.length,
          });
        }
        providerRun = scannerComponents.length > 0
          ? await provider.scanComponents(scannerComponents, executionContext)
          : {
              provider: provider.kind,
              rawOutput: {},
              findings: [],
              durationMs: 0,
            };
        if (isOwaspScan) {
          console.log(`[${loggerLabel}] OWASP execution returned`, {
            findings: providerRun.findings.length,
            durationMs: providerRun.durationMs,
            scannerVersion: providerRun.scannerVersion ?? 'unknown',
          });
        }
      } catch (error) {
        console.error(`[${loggerLabel}] Provider ${providerKind} failed for scan ${scanId}:`, error);
        if (isOwaspScan) {
          console.error(`[${loggerLabel}] OWASP execution failed before persistence`, error);
        }
        providerRun = {
          provider: provider.kind,
          rawOutput: { 
            error: error instanceof Error ? error.message : String(error),
            failed: true,
            failedAt: new Date().toISOString()
          },
          findings: [],
          durationMs: 0,
        };
      }
    }

    console.log(
      `[${loggerLabel}] Provider ${providerKind} completed for scan ${scanId} in ${providerRun.durationMs}ms with ${providerRun.findings.length} findings`,
    );

    const normalizedFindings = providerRun.findings;
    const resultDecision = ingestScannerFindingsWithCycloneDx({
      scanId,
      scannerId,
      components: scannerComponents,
      findings: normalizedFindings,
    });
    logCycloneDxTelemetry(resultDecision.telemetry);

    const artifactCapture = await captureCycloneDxArtifacts({
      scanId,
      scannerId,
      artifacts: [
        {
          artifactType: 'input_sbom',
          payload: hydrated.sbomRaw || {},
        },
        {
          artifactType: 'scanner_result_normalized',
          payload: {
            findings: normalizedFindings,
            scanner: scannerId,
            provider: provider.kind,
          },
        },
      ],
    });

    const ingestionMeta = buildCycloneDxIngestionMeta({
      mode: componentDecision.mode,
      scannerId,
      componentDecision,
      resultDecision,
      artifacts: artifactCapture.artifacts,
      artifactWarnings: artifactCapture.warnings,
    });

    const rawOutputWithMeta = {
      ...(providerRun.rawOutput && typeof providerRun.rawOutput === 'object' ? providerRun.rawOutput : {}),
      ingestionMeta,
      provider: provider.kind,
    };

    const scanResult = await prisma.scanResult.upsert({
      where: {
        scanId_source: {
          scanId,
          source,
        },
      },
      create: {
        scanId,
        source,
        rawOutput: rawOutputWithMeta as unknown as Prisma.InputJsonValue,
        vulnerabilities: normalizedFindings as unknown as Prisma.InputJsonValue,
        scannerVersion: providerRun.scannerVersion ?? provider.kind,
        cveDbTimestamp: new Date(),
        durationMs: providerRun.durationMs,
      },
      update: {
        rawOutput: rawOutputWithMeta as unknown as Prisma.InputJsonValue,
        vulnerabilities: normalizedFindings as unknown as Prisma.InputJsonValue,
        scannerVersion: providerRun.scannerVersion ?? provider.kind,
        cveDbTimestamp: new Date(),
        durationMs: providerRun.durationMs,
      },
    });
    if (isOwaspScan) {
      console.log(`[${loggerLabel}] OWASP scanResult persisted`, { scanResultId: scanResult.id });
    }

    await persistCycloneDxRolloutSnapshot({
      prisma: prisma as any,
      scanResultId: scanResult.id,
      scannerId,
      ingestionMeta,
    });

    await persistNormalizedFindingsForScan({
      prisma: input.prisma,
      scanId: input.scanId,
      userId: input.userId,
      source: input.source,
      findings: normalizedFindings,
    });

    console.log(`[${loggerLabel}] Created ${normalizedFindings.length} findings for scan ${scanId}`);
    if (isOwaspScan) {
      console.log(`[${loggerLabel}] OWASP normalization/persistence complete`, {
        findings: normalizedFindings.length,
      });
    }
    await finalizeScanIfReady({
      prisma: prisma as any,
      scanId,
      userId,
      findingsCount: normalizedFindings.length,
      loggerLabel,
    });

    return {
      status: 'completed',
      findingsCount: normalizedFindings.length,
      scanResultId: scanResult.id,
    };
  } catch (error) {
    console.error(`[${loggerLabel}] Error in scan ${scanId}:`, error);
    if (isOwaspScan) {
      console.error(`[${loggerLabel}] OWASP pipeline failed`, error);
    }
    const errorMessage = error instanceof Error ? error.message : String(error);
    await handleScannerFailure({
      prisma: prisma as any,
      scanId,
      userId,
      scannerId: source,
      errorMessage: `${loggerLabel} failed: ${errorMessage}`,
      loggerLabel,
    });

    throw error;
  }
}
