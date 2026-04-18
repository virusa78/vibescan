/**
 * Input Adapter Tests - SBOM, ZIP, and GitHub scanning
 * Tests validation, normalization, and component extraction
 */

import {
  validateAndExtractSBOM,
  validateGitHubUrl,
  parseSyftOutput,
  normalizeComponents,
  NormalizedComponent,
} from '../../wasp-app/src/server/services/inputAdapterService';

describe('Input Adapter Service', () => {
  describe('SBOM Validation and Extraction', () => {
    it('should parse valid CycloneDX SBOM', () => {
      const sbomJson = JSON.stringify({
        components: [
          {
            name: 'axios',
            version: '1.4.0',
            purl: 'pkg:npm/axios@1.4.0',
            type: 'library',
          },
          {
            name: 'express',
            version: '4.18.2',
            purl: 'pkg:npm/express@4.18.2',
            type: 'library',
          },
        ],
      });

      const result = validateAndExtractSBOM(sbomJson);

      expect(result.components).toHaveLength(2);
      expect(result.totalComponents).toBe(2);
      expect(result.components[0].name).toBe('axios');
      expect(result.components[0].version).toBe('1.4.0');
      expect(result.components[0].purl).toBe('pkg:npm/axios@1.4.0');
    });

    it('should handle SBOM with missing version', () => {
      const sbomJson = JSON.stringify({
        components: [
          {
            name: 'some-package',
            purl: 'pkg:npm/some-package',
          },
        ],
      });

      const result = validateAndExtractSBOM(sbomJson);

      expect(result.components).toHaveLength(1);
      expect(result.components[0].name).toBe('some-package');
      expect(result.components[0].version).toBe('unknown');
    });

    it('should handle empty components array', () => {
      const sbomJson = JSON.stringify({
        components: [],
      });

      const result = validateAndExtractSBOM(sbomJson);

      expect(result.components).toHaveLength(0);
      expect(result.totalComponents).toBe(0);
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => {
        validateAndExtractSBOM(invalidJson);
      }).toThrow('Invalid SBOM format');
    });

    it('should throw on missing components array', () => {
      const sbomJson = JSON.stringify({
        metadata: { timestamp: '2024-01-01' },
      });

      expect(() => {
        validateAndExtractSBOM(sbomJson);
      }).toThrow('Invalid SBOM format');
    });

    it('should filter out components without name', () => {
      const sbomJson = JSON.stringify({
        components: [
          { name: 'valid-package', version: '1.0.0' },
          { version: '2.0.0' },
          { name: 'another-valid', version: '3.0.0' },
        ],
      });

      const result = validateAndExtractSBOM(sbomJson);

      expect(result.components).toHaveLength(2);
      expect(result.components[0].name).toBe('valid-package');
      expect(result.components[1].name).toBe('another-valid');
    });
  });

  describe('GitHub URL Validation', () => {
    it('should validate correct GitHub URL', () => {
      const url = 'https://github.com/axios/axios';

      const result = validateGitHubUrl(url);

      expect(result.owner).toBe('axios');
      expect(result.repo).toBe('axios');
    });

    it('should handle repo names with dots and dashes', () => {
      const url = 'https://github.com/user/my-repo.name';

      const result = validateGitHubUrl(url);

      expect(result.owner).toBe('user');
      expect(result.repo).toBe('my-repo.name');
    });

    it('should reject non-HTTPS URLs', () => {
      const url = 'http://github.com/user/repo';

      expect(() => {
        validateGitHubUrl(url);
      }).toThrow('Invalid GitHub URL');
    });

    it('should reject URLs without github.com', () => {
      const url = 'https://gitlab.com/user/repo';

      expect(() => {
        validateGitHubUrl(url);
      }).toThrow('Invalid GitHub URL');
    });

    it('should reject URLs with extra paths', () => {
      const url = 'https://github.com/user/repo/issues';

      expect(() => {
        validateGitHubUrl(url);
      }).toThrow('Invalid GitHub URL');
    });
  });

  describe('Syft Output Parsing', () => {
    it('should parse valid Syft JSON output', () => {
      const syftJson = JSON.stringify({
        artifacts: [
          {
            name: 'requests',
            version: '2.28.1',
            purl: 'pkg:pypi/requests@2.28.1',
            type: 'python',
          },
          {
            name: 'flask',
            version: '2.1.2',
            purl: 'pkg:pypi/flask@2.1.2',
            type: 'python',
          },
        ],
        source: { type: 'directory', target: '/app' },
      });

      const result = parseSyftOutput(syftJson);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('requests');
      expect(result[0].version).toBe('2.28.1');
      expect(result[1].name).toBe('flask');
    });

    it('should handle Syft output with missing artifacts', () => {
      const syftJson = JSON.stringify({
        source: { type: 'directory', target: '/app' },
      });

      const result = parseSyftOutput(syftJson);

      expect(result).toHaveLength(0);
    });

    it('should handle artifacts with missing version', () => {
      const syftJson = JSON.stringify({
        artifacts: [
          {
            name: 'some-package',
            type: 'library',
          },
        ],
      });

      const result = parseSyftOutput(syftJson);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('some-package');
      expect(result[0].version).toBe('unknown');
    });

    it('should throw on invalid JSON', () => {
      const invalidJson = '{ invalid syft output }';

      expect(() => {
        parseSyftOutput(invalidJson);
      }).toThrow();
    });
  });

  describe('Component Normalization', () => {
    it('should normalize components array', async () => {
      const components: NormalizedComponent[] = [
        { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0' },
        { name: 'express', version: '4.18.2' },
      ];

      const result = await normalizeComponents(components);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('axios');
      expect(result[1].name).toBe('express');
    });

    it('should deduplicate identical components', async () => {
      const components: NormalizedComponent[] = [
        { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0' },
        { name: 'axios', version: '1.4.0', purl: 'pkg:npm/axios@1.4.0' },
        { name: 'express', version: '4.18.2' },
      ];

      const result = await normalizeComponents(components);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('axios');
      expect(result[1].name).toBe('express');
    });

    it('should trim whitespace from component names', async () => {
      const components: NormalizedComponent[] = [
        { name: '  axios  ', version: '  1.4.0  ' },
      ];

      const result = await normalizeComponents(components);

      expect(result[0].name).toBe('axios');
      expect(result[0].version).toBe('1.4.0');
    });

    it('should handle empty array', async () => {
      const components: NormalizedComponent[] = [];

      const result = await normalizeComponents(components);

      expect(result).toHaveLength(0);
    });

    it('should throw on non-array input', async () => {
      const invalidInput = { name: 'axios' } as any;

      await expect(normalizeComponents(invalidInput)).rejects.toThrow();
    });

    it('should keep component with different versions as separate', async () => {
      const components: NormalizedComponent[] = [
        { name: 'axios', version: '1.4.0' },
        { name: 'axios', version: '1.5.0' },
      ];

      const result = await normalizeComponents(components);

      expect(result).toHaveLength(2);
    });
  });

  describe('End-to-End Integration', () => {
    it('should process SBOM upload flow', () => {
      const sbomContent = JSON.stringify({
        components: [
          { name: 'axios', version: '1.4.0' },
          { name: 'express', version: '4.18.2' },
          { name: 'axios', version: '1.4.0' },
        ],
      });

      const sbomResult = validateAndExtractSBOM(sbomContent);

      expect(sbomResult.components).toHaveLength(3);
      expect(sbomResult.totalComponents).toBe(3);
    });

    it('should validate GitHub URL for scanning', () => {
      const url = 'https://github.com/axios/axios';

      const urlResult = validateGitHubUrl(url);

      expect(urlResult.owner).toBe('axios');
      expect(urlResult.repo).toBe('axios');
    });
  });
});
