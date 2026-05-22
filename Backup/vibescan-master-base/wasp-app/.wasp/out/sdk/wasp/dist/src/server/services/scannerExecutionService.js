import { getScannerProvider } from '../lib/scanners/scannerProviderRegistry.js';
import { loadScanArtifacts } from './inputAdapterService.js';
import { syncGitHubCheckRunForScan } from './githubCheckRunService.js';
import { buildCycloneDxIngestionMeta, decideComponentsWithCycloneDx, ingestScannerFindingsWithCycloneDx, logCycloneDxTelemetry, } from './cyclonedxIngestionService.js';
import { persistCycloneDxRolloutSnapshot } from './cyclonedxRolloutGovernance.js';
import { captureCycloneDxArtifacts } from './cyclonedxArtifactStorage.js';
import { finalizeScanIfReady, handleScannerFailure } from './scanLifecycleService.js';
import { resolveCredentialsForProvider } from './scannerCredentialResolver.js';
function toCycloneDxScannerId(providerKind) {
    return providerKind === 'grype' ? 'free' : 'enterprise';
}
function toNormalizedComponents(value) {
    return Array.isArray(value) ? value : [];
}
function toSbomRaw(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
function toGitHubContext(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : null;
}
async function loadScanForExecution(prisma, scanId) {
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
async function ensureScanStarted(prisma, scanId, loggerLabel) {
    const startedScan = await prisma.scan.updateMany({
        where: {
            id: scanId,
            status: {
                in: ['pending', 'scanning'],
            },
        },
        data: { status: 'scanning' },
    });
    if (startedScan.count === 0) {
        console.log(`[${loggerLabel}] Scan ${scanId} is no longer active, skipping`);
        return false;
    }
    return true;
}
async function hydrateScanArtifacts(prisma, scan) {
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
                components: hydratedComponents,
                sbomRaw: hydrated.sbomRaw,
            },
        });
    }
    return {
        components: hydratedComponents,
        sbomRaw: hydratedSbomRaw,
    };
}
async function persistFindings(input, findings) {
    for (const finding of findings) {
        const fingerprint = `${finding.cveId}|${finding.package}|${finding.version}`;
        const existingFinding = await input.prisma.finding.findUnique({
            where: {
                scanId_fingerprint: {
                    scanId: input.scanId,
                    fingerprint,
                },
            },
            select: {
                source: true,
                detectedData: true,
            },
        });
        const previousReportedBy = existingFinding?.detectedData
            && typeof existingFinding.detectedData === 'object'
            && !Array.isArray(existingFinding.detectedData)
            && Array.isArray(existingFinding.detectedData.reportedBy)
            ? existingFinding.detectedData.reportedBy
            : existingFinding?.source
                ? [existingFinding.source]
                : [];
        const reportedBy = Array.from(new Set([...previousReportedBy, input.source]));
        const detectedData = {
            ...finding,
            reportedBy,
        };
        await input.prisma.finding.upsert({
            where: {
                scanId_fingerprint: {
                    scanId: input.scanId,
                    fingerprint,
                },
            },
            create: {
                scanId: input.scanId,
                userId: input.userId,
                fingerprint,
                cveId: finding.cveId,
                packageName: finding.package,
                installedVersion: finding.version,
                severity: finding.severity.toUpperCase(),
                cvssScore: finding.cvssScore,
                fixedVersion: finding.fixedVersion,
                description: finding.description,
                source: input.source,
                detectedData: detectedData,
            },
            update: {
                severity: finding.severity.toUpperCase(),
                cvssScore: finding.cvssScore,
                fixedVersion: finding.fixedVersion,
                description: finding.description,
                detectedData: detectedData,
            },
        });
    }
}
export async function executeScannerForScan(input) {
    const { prisma, scanId, userId, source, providerKind, loggerLabel } = input;
    const scannerId = toCycloneDxScannerId(providerKind);
    const provider = getScannerProvider(providerKind);
    try {
        console.log(`[${loggerLabel}] Starting scan ${scanId} for user ${userId} via provider ${providerKind}`);
        const started = await ensureScanStarted(prisma, scanId, loggerLabel);
        if (!started) {
            return {
                status: 'skipped',
                findingsCount: 0,
                scanResultId: null,
            };
        }
        await syncGitHubCheckRunForScan({
            prisma: prisma,
            scanId,
            status: 'in_progress',
        });
        const scan = await loadScanForExecution(prisma, scanId);
        if (!scan) {
            throw new Error(`Scan ${scanId} not found`);
        }
        const hydrated = await hydrateScanArtifacts(prisma, scan);
        if (hydrated.components.length === 0) {
            console.log(`[${loggerLabel}] No components to scan for ${scanId}`);
        }
        const componentDecision = decideComponentsWithCycloneDx({
            scanId,
            scannerId,
            sbomRaw: hydrated.sbomRaw,
            legacyComponents: hydrated.components,
        });
        logCycloneDxTelemetry(componentDecision.telemetry);
        const scannerComponents = componentDecision.selectedComponents;
        const executionContext = {
            scanId,
            userId,
            inputType: scan.inputType,
            inputRef: scan.inputRef,
            credentialSource: input.credentialSource,
            resolvedCredentials: await resolveCredentialsForProvider(prisma, providerKind, input.credentialSource),
        };
        const providerRun = scannerComponents.length > 0
            ? await provider.scanComponents(scannerComponents, executionContext)
            : {
                provider: provider.kind,
                rawOutput: {},
                findings: [],
                durationMs: 0,
            };
        console.log(`[${loggerLabel}] Provider ${providerKind} completed for scan ${scanId} in ${providerRun.durationMs}ms`);
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
                rawOutput: rawOutputWithMeta,
                vulnerabilities: normalizedFindings,
                scannerVersion: providerRun.scannerVersion ?? provider.kind,
                cveDbTimestamp: new Date(),
                durationMs: providerRun.durationMs,
            },
            update: {
                rawOutput: rawOutputWithMeta,
                vulnerabilities: normalizedFindings,
                scannerVersion: providerRun.scannerVersion ?? provider.kind,
                cveDbTimestamp: new Date(),
                durationMs: providerRun.durationMs,
            },
        });
        await persistCycloneDxRolloutSnapshot({
            prisma: prisma,
            scanResultId: scanResult.id,
            scannerId,
            ingestionMeta,
        });
        await persistFindings(input, normalizedFindings);
        console.log(`[${loggerLabel}] Created ${normalizedFindings.length} findings for scan ${scanId}`);
        await finalizeScanIfReady({
            prisma: prisma,
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
    }
    catch (error) {
        console.error(`[${loggerLabel}] Error in scan ${scanId}:`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        await handleScannerFailure({
            prisma: prisma,
            scanId,
            userId,
            scannerId: source,
            errorMessage: `${loggerLabel} failed: ${errorMessage}`,
            loggerLabel,
        });
        throw error;
    }
}
//# sourceMappingURL=scannerExecutionService.js.map