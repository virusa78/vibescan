export function buildSeverityBreakdown(findings) {
    const breakdown = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
    };
    for (const finding of findings) {
        const severity = (finding.severity || 'info').toLowerCase();
        if (severity in breakdown) {
            breakdown[severity]++;
        }
    }
    return breakdown;
}
export function countFindingsBySeverity(findings, severity) {
    return findings.filter((finding) => (finding.severity || 'info').toLowerCase() === severity).length;
}
//# sourceMappingURL=shared.js.map