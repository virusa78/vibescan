import { describe, it, expect } from '@jest/globals';
import { buildDashboardSearch, parseDashboardSearch } from '../../wasp-app/src/dashboard/urlState';

describe('Severity Filtering - URL State Management', () => {
  describe('buildDashboardSearch', () => {
    it('should include severity parameter when provided', () => {
      const search = buildDashboardSearch('submitted', 'desc', [], ['critical'], '');
      expect(search).toContain('severity=critical');
    });

    it('should handle multiple severities', () => {
      const search = buildDashboardSearch('submitted', 'desc', [], ['critical', 'high'], '');
      expect(search).toContain('severity=critical');
      expect(search).toContain('high');
    });

    it('should not include severity when empty array', () => {
      const search = buildDashboardSearch('submitted', 'desc', [], [], '');
      expect(search).not.toContain('severity');
    });

    it('should build complete search string with all parameters', () => {
      const search = buildDashboardSearch('submitted', 'desc', ['done'], ['critical', 'high'], 'lodash');
      expect(search).toContain('sort=submitted');
      expect(search).toContain('dir=desc');
      expect(search).toContain('status=done');
      expect(search).toContain('severity=critical');
      expect(search).toContain('high');
      expect(search).toContain('q=lodash');
    });
  });

  describe('parseDashboardSearch', () => {
    it('should parse severity parameter from URL', () => {
      const parsed = parseDashboardSearch('?severity=critical');
      expect(parsed.severities).toEqual(['critical']);
    });

    it('should parse multiple severities', () => {
      const parsed = parseDashboardSearch('?severity=critical,high,medium');
      expect(parsed.severities).toContain('critical');
      expect(parsed.severities).toContain('high');
      expect(parsed.severities).toContain('medium');
    });

    it('should default to empty severities array', () => {
      const parsed = parseDashboardSearch('?sort=submitted');
      expect(parsed.severities).toEqual([]);
    });

    it('should handle malformed severity values', () => {
      const parsed = parseDashboardSearch('?severity=invalid,critical,bogus,high');
      // Should filter out invalid values
      expect(parsed.severities.length).toBeLessThan(4);
      expect(parsed.severities).toContain('critical');
      expect(parsed.severities).toContain('high');
    });

    it('should preserve case-insensitivity for severity values', () => {
      const parsed = parseDashboardSearch('?severity=CRITICAL,High,MeDiUm');
      expect(parsed.severities).toContain('critical');
      expect(parsed.severities).toContain('high');
      expect(parsed.severities).toContain('medium');
    });

    it('should build normalized search string matching original', () => {
      const original = '?sort=submitted&dir=desc&severity=critical,high&status=done&q=test';
      const parsed = parseDashboardSearch(original);
      const rebuilt = buildDashboardSearch(
        parsed.sortField,
        parsed.sortDirection,
        parsed.statuses,
        parsed.severities,
        parsed.query
      );
      expect(rebuilt).toContain('severity=critical');
      expect(rebuilt).toContain('high');
    });
  });

  describe('Round-trip encoding/decoding', () => {
    it('should preserve severity through encode-decode cycle', () => {
      const original = {
        sortField: 'submitted' as const,
        sortDirection: 'desc' as const,
        statuses: [] as any[],
        severities: ['critical', 'high'] as any[],
        query: '',
      };

      const encoded = buildDashboardSearch(
        original.sortField,
        original.sortDirection,
        original.statuses,
        original.severities,
        original.query
      );

      const decoded = parseDashboardSearch(encoded);

      expect(decoded.sortField).toBe(original.sortField);
      expect(decoded.sortDirection).toBe(original.sortDirection);
      expect(decoded.severities).toEqual(original.severities);
    });

    it('should handle all 5 severity levels', () => {
      const allSeverities = ['critical', 'high', 'medium', 'low', 'info'] as any[];

      const encoded = buildDashboardSearch('submitted', 'desc', [], allSeverities, '');
      const decoded = parseDashboardSearch(encoded);

      expect(decoded.severities).toHaveLength(5);
      allSeverities.forEach((severity) => {
        expect(decoded.severities).toContain(severity);
      });
    });
  });

  describe('URL state normalization', () => {
    it('should indicate valid state for correct severity params', () => {
      const parsed = parseDashboardSearch('?sort=submitted&dir=desc&severity=critical');
      // Should be valid since all params are recognized and in normalized order
      expect(parsed.isValid).toBe(true);
      expect(parsed.severities).toContain('critical');
    });

    it('should provide normalized search string', () => {
      const parsed = parseDashboardSearch('?severity=critical');
      expect(parsed.normalizedSearch).toContain('severity=critical');
      expect(parsed.normalizedSearch).toContain('sort=submitted'); // Should add defaults
      expect(parsed.normalizedSearch).toContain('dir=desc'); // Should add defaults
    });
  });
});
