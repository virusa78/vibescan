const STATUS_VALUES = ['pending', 'scanning', 'done', 'error', 'cancelled'];
const SORT_VALUES = ['submitted', 'target', 'type', 'status', 'findings'];
const DIRECTION_VALUES = ['asc', 'desc'];
const DEFAULT_SORT = 'submitted';
const DEFAULT_DIR = 'desc';
export function normalizeStatusValue(raw) {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'completed')
        return 'done';
    if (normalized === 'failed')
        return 'error';
    if (normalized === 'running' || normalized === 'queued')
        return 'scanning';
    return STATUS_VALUES.includes(normalized)
        ? normalized
        : null;
}
export function buildDashboardSearch(sortField, sortDirection, statuses, query) {
    const params = new URLSearchParams();
    params.set('sort', sortField);
    params.set('dir', sortDirection);
    if (statuses.length > 0) {
        params.set('status', statuses.join(','));
    }
    const trimmedQuery = query.trim();
    if (trimmedQuery.length > 0) {
        params.set('q', trimmedQuery);
    }
    const encoded = params.toString();
    return encoded ? `?${encoded}` : '';
}
export function parseDashboardSearch(search) {
    const params = new URLSearchParams(search);
    const rawSort = (params.get('sort') ?? '').trim().toLowerCase();
    const rawDir = (params.get('dir') ?? '').trim().toLowerCase();
    const rawStatusCsv = (params.get('status') ?? '').trim();
    const rawQuery = (params.get('q') ?? '').trim();
    const sortField = SORT_VALUES.includes(rawSort)
        ? rawSort
        : DEFAULT_SORT;
    const sortDirection = DIRECTION_VALUES.includes(rawDir)
        ? rawDir
        : DEFAULT_DIR;
    const statuses = Array.from(new Set(rawStatusCsv
        .split(',')
        .map((value) => normalizeStatusValue(value))
        .filter((value) => value !== null)));
    const hasUnknownKeys = Array.from(params.keys()).some((key) => key !== 'sort' && key !== 'dir' && key !== 'status' && key !== 'q');
    const normalizedSearch = buildDashboardSearch(sortField, sortDirection, statuses, rawQuery);
    const normalizedRaw = search ? (search.startsWith('?') ? search : `?${search}`) : '';
    const isValid = !hasUnknownKeys && normalizedRaw === normalizedSearch;
    return {
        sortField,
        sortDirection,
        statuses,
        query: rawQuery,
        isValid,
        normalizedSearch,
    };
}
//# sourceMappingURL=urlState.js.map