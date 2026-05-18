import { describe, expect, test } from "@jest/globals";
import {
  buildDashboardSearch,
  parseDashboardSearch,
} from '../../wasp-app/src/dashboard/urlState';

describe('dashboard url state', () => {
  test('builds and parses full search state including q', () => {
    const search = buildDashboardSearch('submitted', 'desc', ['scanning', 'done'], 'lodash');
    expect(search).toBe('?sort=submitted&dir=desc&status=scanning%2Cdone&q=lodash');

    const parsed = parseDashboardSearch(search);
    expect(parsed.sortField).toBe('submitted');
    expect(parsed.sortDirection).toBe('desc');
    expect(parsed.statuses).toEqual(['scanning', 'done']);
    expect(parsed.query).toBe('lodash');
    expect(parsed.isValid).toBe(true);
  });

  test('normalizes invalid keys and trims q without adding history noise', () => {
    const parsed = parseDashboardSearch('?sort=invalid&dir=up&status=scanning,bad&q=%20cve-1234%20&x=1');
    expect(parsed.sortField).toBe('submitted');
    expect(parsed.sortDirection).toBe('desc');
    expect(parsed.statuses).toEqual(['scanning']);
    expect(parsed.query).toBe('cve-1234');
    expect(parsed.isValid).toBe(false);
    expect(parsed.normalizedSearch).toBe('?sort=submitted&dir=desc&status=scanning&q=cve-1234');
  });

  test('maps legacy status aliases and drops empty q', () => {
    const parsed = parseDashboardSearch('?sort=target&dir=asc&status=completed,failed,running,queued&q=%20%20');
    expect(parsed.sortField).toBe('target');
    expect(parsed.sortDirection).toBe('asc');
    expect(parsed.statuses).toEqual(['done', 'error', 'scanning']);
    expect(parsed.query).toBe('');
    expect(parsed.normalizedSearch).toBe('?sort=target&dir=asc&status=done%2Cerror%2Cscanning');
  });
});

describe('buildDashboardSearch', () => {
  test('should build basic search string with sort and dir', () => {
    const result = buildDashboardSearch('submitted', 'desc', [], '');
    expect(result).toBe('?sort=submitted&dir=desc');
  });

  test('should include single status', () => {
    const result = buildDashboardSearch('target', 'asc', ['pending'], '');
    expect(result).toBe('?sort=target&dir=asc&status=pending');
  });

  test('should include multiple statuses', () => {
    const result = buildDashboardSearch('status', 'desc', ['pending', 'done', 'error'], '');
    expect(result).toBe('?sort=status&dir=desc&status=pending%2Cdone%2Cerror');
  });

  test('should include a search query', () => {
    const result = buildDashboardSearch('submitted', 'desc', [], 'test search');
    expect(result).toBe('?sort=submitted&dir=desc&q=test+search');
  });

  test('should ignore empty and whitespace-only queries', () => {
    const result1 = buildDashboardSearch('submitted', 'desc', [], '   ');
    expect(result1).toBe('?sort=submitted&dir=desc');

    const result2 = buildDashboardSearch('submitted', 'desc', [], '');
    expect(result2).toBe('?sort=submitted&dir=desc');
  });

  test('should trim query strings before adding', () => {
    const result = buildDashboardSearch('submitted', 'desc', [], '  test search  ');
    expect(result).toBe('?sort=submitted&dir=desc&q=test+search');
  });

  test('should handle all parameters combined', () => {
    const result = buildDashboardSearch('findings', 'asc', ['scanning', 'error'], '  critical issue  ');
    expect(result).toBe('?sort=findings&dir=asc&status=scanning%2Cerror&q=critical+issue');
  });
});
