import { describe, expect, it } from '@jest/globals';
import { computeFingerprint, type NormalizedFinding } from '../../wasp-app/src/scans/reimportLogic';

describe('reimportLogic.computeFingerprint', () => {
  const baseFinding: NormalizedFinding = {
    cveId: 'CVE-2024-1234',
    packageName: 'lodash',
    installedVersion: '4.17.20',
    filePath: 'node_modules/lodash/package.json',
    severity: 'high',
    cvssScore: 7.5,
    fixedVersion: '4.17.21',
    description: 'A test vulnerability',
    source: 'grype' as any,
  };

  it('returns a stable sha256 hash for identical inputs', () => {
    const first = computeFingerprint(baseFinding);
    const second = computeFingerprint({ ...baseFinding });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it('changes when cveId changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, cveId: 'CVE-2024-5678' });

    expect(changed).not.toBe(original);
  });

  it('changes when packageName changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, packageName: 'underscore' });

    expect(changed).not.toBe(original);
  });

  it('changes when installedVersion changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, installedVersion: '4.17.19' });

    expect(changed).not.toBe(original);
  });

  it('changes when filePath changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, filePath: 'src/node_modules/lodash/package.json' });

    expect(changed).not.toBe(original);
  });

  it('does not change when severity changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, severity: 'critical' });

    expect(changed).toBe(original);
  });

  it('does not change when cvssScore changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, cvssScore: 9.8 });

    expect(changed).toBe(original);
  });

  it('does not change when description changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, description: 'Updated description' });

    expect(changed).toBe(original);
  });

  it('does not change when fixedVersion changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, fixedVersion: '4.17.22' });

    expect(changed).toBe(original);
  });

  it('does not change when source changes', () => {
    const original = computeFingerprint(baseFinding);
    const changed = computeFingerprint({ ...baseFinding, source: 'trivy' as any });

    expect(changed).toBe(original);
  });

  it('treats missing filePath the same as empty filePath', () => {
    const { filePath, ...withoutPath } = baseFinding;
    const hashWithoutPath = computeFingerprint(withoutPath as NormalizedFinding);
    const hashWithEmptyPath = computeFingerprint({ ...baseFinding, filePath: '' });

    expect(hashWithoutPath).toHaveLength(64);
    expect(hashWithoutPath).toBe(hashWithEmptyPath);
    expect(hashWithoutPath).not.toBe(computeFingerprint(baseFinding));
  });
});
