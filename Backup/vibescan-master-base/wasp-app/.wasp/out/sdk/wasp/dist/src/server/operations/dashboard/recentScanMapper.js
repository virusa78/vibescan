function countJsonArrayItems(value) {
    return Array.isArray(value) ? value.length : 0;
}
function buildCountsBySource(scan) {
    return (scan.scanResults || []).reduce((accumulator, result) => {
        accumulator[result.source] = countJsonArrayItems(result.vulnerabilities);
        return accumulator;
    }, {});
}
export function mapRecentScans(scans) {
    return scans.map((scan) => ({
        id: scan.id,
        status: scan.status,
        inputType: scan.inputType,
        inputRef: scan.inputRef,
        planAtSubmission: scan.planAtSubmission,
        planned_sources: Array.isArray(scan.plannedSources) ? scan.plannedSources : [],
        created_at: scan.createdAt,
        completed_at: scan.completedAt,
        vulnerability_count: scan._count?.findings ?? 0,
        counts_by_source: buildCountsBySource(scan),
    }));
}
//# sourceMappingURL=recentScanMapper.js.map