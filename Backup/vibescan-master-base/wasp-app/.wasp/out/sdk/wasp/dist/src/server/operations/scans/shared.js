export function countJsonArrayItems(value) {
    return Array.isArray(value) ? value.length : 0;
}
export function mapScanSummary(scan) {
    return {
        id: scan.id,
        status: scan.status,
        inputType: scan.inputType,
        inputRef: scan.inputRef,
        planAtSubmission: scan.planAtSubmission,
        created_at: scan.createdAt,
        completed_at: scan.completedAt,
    };
}
//# sourceMappingURL=shared.js.map