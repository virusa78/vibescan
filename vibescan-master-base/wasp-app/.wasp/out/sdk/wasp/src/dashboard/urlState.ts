export type DashboardSortField = 'submitted' | 'target' | 'type' | 'status' | 'findings';
export type DashboardSortDirection = 'asc' | 'desc';
export type DashboardStatus = 'pending' | 'scanning' | 'done' | 'error' | 'cancelled';

const STATUS_VALUES: DashboardStatus[] = ['pending', 'scanning', 'done', 'error', 'cancelled'];
const SORT_VALUES: DashboardSortField[] = ['submitted', 'target', 'type', 'status', 'findings'];
const DIRECTION_VALUES: DashboardSortDirection[] = ['asc', 'desc'];

const DEFAULT_SORT: DashboardSortField = 'submitted';
const DEFAULT_DIR: DashboardSortDirection = 'desc';

export type ParsedDashboardSearch = {
  sortField: DashboardSortField;
  sortDirection: DashboardSortDirection;
  statuses: DashboardStatus[];
  query: string;
  isValid: boolean;
  normalizedSearch: string;
};

export function normalizeStatusValue(raw: string): DashboardStatus | null {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'completed') return 'done';
  if (normalized === 'failed') return 'error';
  if (normalized === 'running' || normalized === 'queued') return 'scanning';

  return STATUS_VALUES.includes(normalized as DashboardStatus)
    ? (normalized as DashboardStatus)
    : null;
}

export function buildDashboardSearch(
  sortField: DashboardSortField,
  sortDirection: DashboardSortDirection,
  statuses: DashboardStatus[],
  query: string,
): string {
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

export function parseDashboardSearch(search: string): ParsedDashboardSearch {
  const params = new URLSearchParams(search);

  const rawSort = (params.get('sort') ?? '').trim().toLowerCase();
  const rawDir = (params.get('dir') ?? '').trim().toLowerCase();
  const rawStatusCsv = (params.get('status') ?? '').trim();
  const rawQuery = (params.get('q') ?? '').trim();

  const sortField = SORT_VALUES.includes(rawSort as DashboardSortField)
    ? (rawSort as DashboardSortField)
    : DEFAULT_SORT;
  const sortDirection = DIRECTION_VALUES.includes(rawDir as DashboardSortDirection)
    ? (rawDir as DashboardSortDirection)
    : DEFAULT_DIR;

  const statuses = Array.from(
    new Set(
      rawStatusCsv
        .split(',')
        .map((value) => normalizeStatusValue(value))
        .filter((value): value is DashboardStatus => value !== null),
    ),
  );

  const hasUnknownKeys = Array.from(params.keys()).some(
    (key) => key !== 'sort' && key !== 'dir' && key !== 'status' && key !== 'q',
  );

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
