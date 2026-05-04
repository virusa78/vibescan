import { fromCycloneDX, } from '../../ingestion/cyclonedx-contracts.js';
const triageTransitions = {
    new: ['new', 'accepted', 'mapped', 'ignored'],
    accepted: ['accepted', 'mapped', 'ignored'],
    mapped: ['mapped'],
    ignored: ['ignored', 'mapped'],
};
const unknownFieldCatalog = new Map();
function envFlag(value, defaultValue = false) {
    if (value == null)
        return defaultValue;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}
function parseNumberFlag(value, fallback) {
    if (!value)
        return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function catalogKey(scannerId, specVersion, path) {
    return `${scannerId}|${specVersion}|${path}`;
}
function toSnapshot(entry) {
    return {
        scannerId: entry.scannerId,
        specVersion: entry.specVersion,
        path: entry.path,
        firstSeen: entry.firstSeen.toISOString(),
        lastSeen: entry.lastSeen.toISOString(),
        count: entry.count,
        status: entry.status,
    };
}
function getUnknownFieldStatus(scannerId, specVersion, path) {
    const entry = unknownFieldCatalog.get(catalogKey(scannerId, specVersion, path));
    return entry?.status || 'new';
}
function componentKey(component) {
    const name = component.name.trim();
    const version = component.version.trim();
    const purl = component.purl?.trim();
    return purl || `${name}@${version}`;
}
function toNormalizedComponents(payload) {
    return payload.components
        .map((component) => ({
        name: component.name,
        version: component.version,
        purl: component.purl,
        type: component.type,
    }))
        .filter((component) => component.name && component.version && component.version !== 'unknown');
}
function computeDrift(legacy, unified) {
    const legacySet = new Set(legacy.map(componentKey));
    const unifiedSet = new Set(unified.map(componentKey));
    let missingInUnified = 0;
    for (const key of legacySet) {
        if (!unifiedSet.has(key))
            missingInUnified += 1;
    }
    let extraInUnified = 0;
    for (const key of unifiedSet) {
        if (!legacySet.has(key))
            extraInUnified += 1;
    }
    return {
        legacyComponents: legacy.length,
        unifiedComponents: unified.length,
        missingInUnified,
        extraInUnified,
    };
}
function safeSeverity(level) {
    const normalized = level.trim().toLowerCase();
    if (normalized === 'critical' || normalized === 'high' || normalized === 'medium' || normalized === 'low' || normalized === 'info') {
        return normalized;
    }
    return 'info';
}
function pickBomRef(component) {
    return component.purl?.trim() || `${component.name}@${component.version}`;
}
function buildCycloneDxFromFindings(scannerId, components, findings) {
    const componentDocs = components.map((component) => ({
        'bom-ref': pickBomRef(component),
        type: component.type || 'library',
        name: component.name,
        version: component.version,
        purl: component.purl,
    }));
    const componentRefs = new Map();
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
function buildTelemetry(scanId, scannerId, mode, stage, result, drift) {
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
function updateUnknownFieldCatalog(scannerId, ingestionResult, observedAt) {
    if (!ingestionResult || ingestionResult.status !== 'ingested') {
        return;
    }
    const specVersion = ingestionResult.payload._originalDocument.specVersion || 'unknown';
    for (const path of ingestionResult.payload._unknownFields.keys()) {
        const key = catalogKey(scannerId, specVersion, path);
        const existing = unknownFieldCatalog.get(key);
        if (!existing) {
            unknownFieldCatalog.set(key, {
                scannerId,
                specVersion,
                path,
                firstSeen: observedAt,
                lastSeen: observedAt,
                count: 1,
                status: getUnknownFieldStatus(scannerId, specVersion, path),
            });
            continue;
        }
        existing.lastSeen = observedAt;
        existing.count += 1;
    }
}
function safeDriftRate(drift) {
    if (!drift)
        return 0;
    const base = Math.max(1, drift.legacyComponents);
    return (drift.missingInUnified + drift.extraInUnified) / base;
}
export function resolveCanaryRolloutStage() {
    const raw = process.env.VIBESCAN_CYCLONEDX_CANARY_STAGE?.trim().toLowerCase();
    if (raw === 'canary_cutover_cohort' || raw === 'expand_cohort' || raw === 'shadow_smoke' || raw === 'ready_for_prod') {
        return raw;
    }
    return 'shadow_smoke';
}
function nextCanaryStage(stage) {
    if (stage === 'shadow_smoke')
        return 'canary_cutover_cohort';
    if (stage === 'canary_cutover_cohort')
        return 'expand_cohort';
    if (stage === 'expand_cohort')
        return 'ready_for_prod';
    return null;
}
function evaluateCanaryDecision(options) {
    const stage = resolveCanaryRolloutStage();
    const reasons = [...options.gateReasons];
    if (options.mode === 'rollback') {
        return {
            scannerId: options.scannerId,
            stage,
            status: 'rollback_required',
            nextStage: null,
            reasons: ['rollback_mode_active'],
        };
    }
    if (options.mode === 'legacy') {
        return {
            scannerId: options.scannerId,
            stage,
            status: 'block_promote',
            nextStage: null,
            reasons: ['legacy_mode_not_eligible_for_canary'],
        };
    }
    if (stage === 'shadow_smoke' && options.mode !== 'shadow') {
        return {
            scannerId: options.scannerId,
            stage,
            status: 'block_promote',
            nextStage: null,
            reasons: ['shadow_smoke_requires_shadow_mode', ...reasons],
        };
    }
    if ((stage === 'canary_cutover_cohort' || stage === 'expand_cohort') && options.mode !== 'cutover') {
        return {
            scannerId: options.scannerId,
            stage,
            status: 'block_promote',
            nextStage: null,
            reasons: ['cutover_stage_requires_cutover_mode', ...reasons],
        };
    }
    if (stage === 'ready_for_prod' && options.mode !== 'cutover') {
        return {
            scannerId: options.scannerId,
            stage,
            status: 'block_promote',
            nextStage: null,
            reasons: ['ready_for_prod_requires_cutover_mode', ...reasons],
        };
    }
    if (options.gateStatus === 'block_cutover') {
        return {
            scannerId: options.scannerId,
            stage,
            status: 'block_promote',
            nextStage: null,
            reasons,
        };
    }
    return {
        scannerId: options.scannerId,
        stage,
        status: 'allow_promote',
        nextStage: nextCanaryStage(stage),
        reasons: reasons.length > 0 ? reasons : ['ready_for_stage_promotion'],
    };
}
export function getUnknownFieldCatalogSnapshot() {
    return Array.from(unknownFieldCatalog.values())
        .sort((a, b) => {
        if (a.scannerId !== b.scannerId)
            return a.scannerId.localeCompare(b.scannerId);
        if (a.specVersion !== b.specVersion)
            return a.specVersion.localeCompare(b.specVersion);
        return a.path.localeCompare(b.path);
    })
        .map(toSnapshot);
}
export function resetUnknownFieldCatalogForTests() {
    unknownFieldCatalog.clear();
}
export function setUnknownFieldTriageStatus(options) {
    const { scannerId, specVersion, path, status } = options;
    const key = catalogKey(scannerId, specVersion, path);
    const now = new Date();
    const existing = unknownFieldCatalog.get(key);
    if (!existing) {
        const entry = {
            scannerId,
            specVersion,
            path,
            firstSeen: now,
            lastSeen: now,
            count: 0,
            status,
        };
        unknownFieldCatalog.set(key, entry);
        return toSnapshot(entry);
    }
    const allowed = triageTransitions[existing.status];
    if (!allowed.includes(status)) {
        throw new Error(`invalid_triage_transition:${existing.status}->${status}`);
    }
    existing.status = status;
    existing.lastSeen = now;
    return toSnapshot(existing);
}
export function evaluateCutoverQualityGate(options) {
    const { mode, componentTelemetry, result } = options;
    const driftThreshold = parseNumberFlag(process.env.VIBESCAN_CYCLONEDX_DRIFT_RATE_THRESHOLD, 0.10);
    const driftRate = safeDriftRate(componentTelemetry?.drift);
    if (mode === 'rollback') {
        const reasons = ['rollback_mode_ignores_cutover_decision'];
        return {
            status: 'not_applicable',
            mode,
            driftRate,
            driftThreshold,
            blockerErrors: [],
            reasons,
            canaryDecision: evaluateCanaryDecision({
                scannerId: options.scannerId,
                mode,
                gateStatus: 'not_applicable',
                gateReasons: reasons,
            }),
        };
    }
    const blockerErrors = [];
    const reasons = [];
    if (result.status === 'rejected') {
        if (result.error.type === 'validation_error' || result.error.type === 'unify_error') {
            blockerErrors.push(result.error.type);
            reasons.push(`blocker_error:${result.error.type}`);
        }
    }
    if (driftRate > driftThreshold) {
        reasons.push(`drift_rate_exceeded:${driftRate.toFixed(4)}>${driftThreshold.toFixed(4)}`);
    }
    if (options.warnings && options.warnings.length > 0) {
        reasons.push(...options.warnings.map((warning) => `warning:${warning}`));
    }
    const shouldBlock = blockerErrors.length > 0 || driftRate > driftThreshold;
    const status = shouldBlock ? 'block_cutover' : 'allow_cutover';
    const gateReasons = shouldBlock ? reasons : reasons.length > 0 ? reasons : ['within_threshold'];
    return {
        status,
        mode,
        driftRate,
        driftThreshold,
        blockerErrors,
        reasons: gateReasons,
        canaryDecision: evaluateCanaryDecision({
            scannerId: options.scannerId,
            mode,
            gateStatus: status,
            gateReasons,
        }),
    };
}
export function buildCycloneDxIngestionMeta(options) {
    const observedAt = new Date();
    updateUnknownFieldCatalog(options.scannerId, options.componentDecision.ingestionResult, observedAt);
    updateUnknownFieldCatalog(options.scannerId, options.resultDecision.ingestionResult, observedAt);
    return {
        mode: options.mode,
        componentIngestion: options.componentDecision.telemetry,
        resultIngestion: options.resultDecision.telemetry,
        resultStatus: options.resultDecision.ingestionResult.status,
        unifiedStats: options.resultDecision.ingestionResult.status === 'ingested'
            ? options.resultDecision.ingestionResult.payload.stats
            : null,
        artifacts: options.artifacts || [],
        unknownFieldCatalog: getUnknownFieldCatalogSnapshot(),
        gate: evaluateCutoverQualityGate({
            scannerId: options.scannerId,
            mode: options.mode,
            componentTelemetry: options.componentDecision.telemetry,
            result: options.resultDecision.ingestionResult,
            warnings: options.artifactWarnings,
        }),
    };
}
export function resolveCycloneDxPipelineMode() {
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
export function decideComponentsWithCycloneDx(options) {
    const mode = resolveCycloneDxPipelineMode();
    const { scanId, scannerId, sbomRaw, legacyComponents } = options;
    if (!sbomRaw || mode === 'legacy') {
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
export function ingestScannerFindingsWithCycloneDx(options) {
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
export function logCycloneDxTelemetry(telemetry) {
    console.log('[CycloneDXIngestion]', JSON.stringify(telemetry));
}
//# sourceMappingURL=cyclonedxIngestionService.js.map