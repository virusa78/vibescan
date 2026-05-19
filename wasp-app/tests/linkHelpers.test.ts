// No imports needed, jest exposes these globally when test environment is setup
import {
  resolveCveId,
  buildGitHubAdvisoryUrl,
  buildNvdUrl,
  buildPackageUrl
} from '../src/reports/linkHelpers';

describe('linkHelpers', () => {
  describe('resolveCveId', () => {
    it('should resolve cveId if it exists', () => {
      const finding = { cveId: 'CVE-2023-1234' };
      expect(resolveCveId(finding)).toBe('CVE-2023-1234');
    });

    it('should resolve cve if cveId does not exist', () => {
      const finding = { cve: 'CVE-2023-5678' };
      expect(resolveCveId(finding)).toBe('CVE-2023-5678');
    });

    it('should prioritize cveId over cve', () => {
      const finding = { cveId: 'CVE-2023-1234', cve: 'CVE-2023-5678' };
      expect(resolveCveId(finding)).toBe('CVE-2023-1234');
    });

    it('should return empty string if neither cveId nor cve exists', () => {
      const finding = {};
      expect(resolveCveId(finding)).toBe('');
    });
  });

  describe('buildGitHubAdvisoryUrl', () => {
    it('should build a proper GitHub advisory URL', () => {
      expect(buildGitHubAdvisoryUrl('CVE-2023-1234')).toBe('https://github.com/advisories?query=CVE-2023-1234');
    });

    it('should properly URL encode the CVE ID', () => {
      expect(buildGitHubAdvisoryUrl('CVE 2023 1234')).toBe('https://github.com/advisories?query=CVE%202023%201234');
    });
  });

  describe('buildNvdUrl', () => {
    it('should build a proper NVD URL', () => {
      expect(buildNvdUrl('CVE-2023-1234')).toBe('https://nvd.nist.gov/vuln/detail/CVE-2023-1234');
    });

    it('should properly URL encode the CVE ID', () => {
      expect(buildNvdUrl('CVE 2023 1234')).toBe('https://nvd.nist.gov/vuln/detail/CVE%202023%201234');
    });
  });

  describe('buildPackageUrl', () => {
    it('should return null if packageName is empty or undefined', () => {
      expect(buildPackageUrl({})).toBeNull();
      expect(buildPackageUrl({ packageName: '' })).toBeNull();
      expect(buildPackageUrl({ packageName: '   ' })).toBeNull();
    });

    describe('standard ecosystems', () => {
      it('should build npm URL', () => {
        const finding = { packageName: 'lodash', ecosystem: 'npm' };
        expect(buildPackageUrl(finding)).toBe('https://www.npmjs.com/package/lodash');
      });

      it('should properly URL encode npm packages (e.g. scoped packages)', () => {
        const finding = { packageName: '@types/react', ecosystem: 'npm' };
        expect(buildPackageUrl(finding)).toBe('https://www.npmjs.com/package/%40types%2Freact');
      });

      it('should build pypi URL', () => {
        const finding = { packageName: 'Django', ecosystem: 'pypi' };
        expect(buildPackageUrl(finding)).toBe('https://pypi.org/project/Django/');
      });

      it('should properly URL encode pypi packages', () => {
        const finding = { packageName: 'some package', ecosystem: 'pypi' };
        expect(buildPackageUrl(finding)).toBe('https://pypi.org/project/some%20package/');
      });

      it('should build go URL', () => {
        const finding = { packageName: 'github.com/gin-gonic/gin', ecosystem: 'go' };
        expect(buildPackageUrl(finding)).toBe('https://pkg.go.dev/github.com/gin-gonic/gin');
      });

      it('should build docker URL', () => {
        const finding = { packageName: 'postgres', ecosystem: 'docker' };
        expect(buildPackageUrl(finding)).toBe('https://hub.docker.com/_/postgres');
      });

      it('should properly URL encode docker packages', () => {
        const finding = { packageName: 'my-postgres/db', ecosystem: 'docker' };
        expect(buildPackageUrl(finding)).toBe('https://hub.docker.com/_/my-postgres%2Fdb');
      });

      it('should build maven URL', () => {
        const finding = { packageName: 'org.apache.commons:commons-lang3', ecosystem: 'maven' };
        expect(buildPackageUrl(finding)).toBe('https://central.sonatype.com/artifact/org.apache.commons/commons-lang3');
      });

      it('should return null for invalid maven packages (missing colon)', () => {
        const finding = { packageName: 'org.apache.commons.commons-lang3', ecosystem: 'maven' };
        expect(buildPackageUrl(finding)).toBeNull();
      });

      it('should handle ecosystem case-insensitivity', () => {
        const finding = { packageName: 'lodash', ecosystem: 'NPM' };
        expect(buildPackageUrl(finding)).toBe('https://www.npmjs.com/package/lodash');
      });
    });

    describe('purl formats', () => {
      it('should build URL for pkg:npm', () => {
        const finding = { packageName: 'pkg:npm/lodash' };
        expect(buildPackageUrl(finding)).toBe('https://www.npmjs.com/package/lodash');
      });

      it('should properly URL encode pkg:npm scoped packages', () => {
        const finding = { packageName: 'pkg:npm/@types/node' };
        expect(buildPackageUrl(finding)).toBe('https://www.npmjs.com/package/%40types%2Fnode');
      });

      it('should build URL for pkg:pypi', () => {
        const finding = { packageName: 'pkg:pypi/requests' };
        expect(buildPackageUrl(finding)).toBe('https://pypi.org/project/requests/');
      });

      it('should build URL for pkg:golang', () => {
        const finding = { packageName: 'pkg:golang/github.com/gorilla/mux' };
        expect(buildPackageUrl(finding)).toBe('https://pkg.go.dev/github.com/gorilla/mux');
      });

      it('should build URL for pkg:docker', () => {
        const finding = { packageName: 'pkg:docker/nginx' };
        expect(buildPackageUrl(finding)).toBe('https://hub.docker.com/_/nginx');
      });
    });

    it('should return null for unknown ecosystems or purl formats', () => {
      expect(buildPackageUrl({ packageName: 'unknown-pkg', ecosystem: 'unknown' })).toBeNull();
      expect(buildPackageUrl({ packageName: 'pkg:unknown/pkg' })).toBeNull();
    });
  });
});
