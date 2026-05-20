import { describe, expect, it } from '@jest/globals';
import { resolveCveId, buildGitHubAdvisoryUrl } from '../src/reports/linkHelpers';

describe('linkHelpers', () => {
  describe('resolveCveId', () => {
    it('should return cveId when it is present', () => {
      const finding = { cveId: 'CVE-2023-12345' };
      expect(resolveCveId(finding)).toBe('CVE-2023-12345');
    });

    it('should return cve when cveId is not present', () => {
      const finding = { cve: 'CVE-2023-67890' };
      expect(resolveCveId(finding)).toBe('CVE-2023-67890');
    });

    it('should prioritize cveId over cve when both are present', () => {
      const finding = { cveId: 'CVE-2023-11111', cve: 'CVE-2023-22222' };
      expect(resolveCveId(finding)).toBe('CVE-2023-11111');
    });

    it('should return an empty string when neither cveId nor cve is present', () => {
      const finding = {};
      expect(resolveCveId(finding)).toBe('');
    });

    it('should return an empty string when both are explicitly undefined', () => {
      const finding = { cveId: undefined, cve: undefined };
      expect(resolveCveId(finding)).toBe('');
    });
  });

  describe('buildGitHubAdvisoryUrl', () => {
    it('should build the URL correctly with a standard CVE ID', () => {
      expect(buildGitHubAdvisoryUrl('CVE-2023-12345')).toBe('https://github.com/advisories?query=CVE-2023-12345');
    });

    it('should encode CVE IDs that contain special characters', () => {
      expect(buildGitHubAdvisoryUrl('CVE-2023-12345 foo')).toBe('https://github.com/advisories?query=CVE-2023-12345%20foo');
      expect(buildGitHubAdvisoryUrl('GHSA-123?4')).toBe('https://github.com/advisories?query=GHSA-123%3F4');
    });
  });
});
