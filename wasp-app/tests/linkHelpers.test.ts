import { describe, expect, it } from '@jest/globals';
import { buildGitHubAdvisoryUrl, resolveCveId } from '../src/reports/linkHelpers';

describe('linkHelpers', () => {
  describe('resolveCveId', () => {
    it('returns cveId when present', () => {
      expect(resolveCveId({ cveId: 'CVE-2023-12345' })).toBe('CVE-2023-12345');
    });

    it('falls back to cve when cveId is absent', () => {
      expect(resolveCveId({ cve: 'CVE-2023-67890' })).toBe('CVE-2023-67890');
    });
  });

  describe('buildGitHubAdvisoryUrl', () => {
    it('builds the URL correctly', () => {
      expect(buildGitHubAdvisoryUrl('CVE-2023-12345')).toBe('https://github.com/advisories?query=CVE-2023-12345');
    });

    it('encodes special characters', () => {
      expect(buildGitHubAdvisoryUrl('GHSA-123?4')).toBe('https://github.com/advisories?query=GHSA-123%3F4');
    });
  });
});
