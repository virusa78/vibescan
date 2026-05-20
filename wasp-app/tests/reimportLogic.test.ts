import { describe, it, expect } from '@jest/globals';
import { computeFingerprint, type NormalizedFinding } from '../src/scans/reimportLogic';

describe('reimportLogic - computeFingerprint', () => {
  const baseFinding: NormalizedFinding = {
    cveId: 'CVE-2024-1234',
    packageName: 'lodash',
    installedVersion: '4.17.20',
    filePath: 'node_modules/lodash/package.json',
    severity: 'high',
    cvssScore: 7.5,
    description: 'A test vulnerability',
    fixedVersion: '4.17.21',
    source: 'FREE' as any, // casting as we don't have prisma generated types handy to be perfect, but tests only care about fields.
  };

  it('should generate consistent hashes for identical inputs', () => {
    const hash1 = computeFingerprint(baseFinding);
    const hash2 = computeFingerprint({ ...baseFinding });
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    // sha256 hex string is 64 characters
    expect(hash1).toHaveLength(64);
  });

  it('should change fingerprint when cveId changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, cveId: 'CVE-2024-5678' });
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should change fingerprint when packageName changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, packageName: 'underscore' });
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should change fingerprint when installedVersion changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, installedVersion: '4.17.19' });
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should change fingerprint when filePath changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, filePath: 'src/node_modules/lodash/package.json' });
    expect(originalHash).not.toBe(modifiedHash);
  });

  it('should NOT change fingerprint when severity changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, severity: 'critical' });
    expect(originalHash).toBe(modifiedHash);
  });

  it('should NOT change fingerprint when cvssScore changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, cvssScore: 9.8 });
    expect(originalHash).toBe(modifiedHash);
  });

  it('should NOT change fingerprint when description changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, description: 'Updated description' });
    expect(originalHash).toBe(modifiedHash);
  });

  it('should NOT change fingerprint when fixedVersion changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, fixedVersion: '4.17.22' });
    expect(originalHash).toBe(modifiedHash);
  });

  it('should NOT change fingerprint when source changes', () => {
    const originalHash = computeFingerprint(baseFinding);
    const modifiedHash = computeFingerprint({ ...baseFinding, source: 'ENTERPRISE' as any });
    expect(originalHash).toBe(modifiedHash);
  });

  it('should gracefully handle missing filePath (undefined)', () => {
    const { filePath, ...findingWithoutPath } = baseFinding;
    const hashWithoutPath = computeFingerprint(findingWithoutPath as NormalizedFinding);

    // An empty string for filePath should produce the same hash as undefined filePath
    const hashWithEmptyPath = computeFingerprint({ ...baseFinding, filePath: '' });

    expect(typeof hashWithoutPath).toBe('string');
    expect(hashWithoutPath).toHaveLength(64);
    expect(hashWithoutPath).toBe(hashWithEmptyPath);

    // Hash without path should be different from hash with path
    const hashWithPath = computeFingerprint(baseFinding);
    expect(hashWithoutPath).not.toBe(hashWithPath);
  });
});
