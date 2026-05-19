import { describe, expect, it } from '@jest/globals';
import {
  computeFingerprint,
  computeReimportDelta,
  computeReimportSummary,
  NormalizedFinding,
} from '../src/scans/reimportLogic';
import type { ScanSource } from '@prisma/client';

describe('Reimport Logic', () => {
  describe('computeReimportDelta', () => {
    it('should return empty arrays when both old and new findings are empty', () => {
      const result = computeReimportDelta([], []);
      expect(result.new).toHaveLength(0);
      expect(result.mitigated).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should classify new findings correctly', () => {
      const newFindings: NormalizedFinding[] = [
        {
          cveId: 'CVE-2024-0001',
          packageName: 'pkg-a',
          installedVersion: '1.0.0',
          severity: 'high',
          source: 'free' as ScanSource,
        },
      ];

      const result = computeReimportDelta([], newFindings);

      expect(result.new).toHaveLength(1);
      expect(result.new[0]).toEqual(newFindings[0]);
      expect(result.mitigated).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should classify mitigated findings correctly', () => {
      const oldFindings: NormalizedFinding[] = [
        {
          cveId: 'CVE-2024-0002',
          packageName: 'pkg-b',
          installedVersion: '1.0.0',
          severity: 'critical',
          source: 'free' as ScanSource,
        },
      ];

      const result = computeReimportDelta(oldFindings, []);

      expect(result.new).toHaveLength(0);
      expect(result.mitigated).toHaveLength(1);
      expect(result.mitigated[0].findingId).toBe('CVE-2024-0002');
      expect(result.updated).toHaveLength(0);
      expect(result.unchanged).toHaveLength(0);
    });

    it('should classify updated findings correctly (severity change)', () => {
      const oldFindings: NormalizedFinding[] = [
        {
          cveId: 'CVE-2024-0003',
          packageName: 'pkg-c',
          installedVersion: '2.0.0',
          severity: 'medium',
          source: 'free' as ScanSource,
        },
      ];

      const newFindings: NormalizedFinding[] = [
        {
          ...oldFindings[0],
          severity: 'high',
        },
      ];

      const result = computeReimportDelta(oldFindings, newFindings);

      expect(result.new).toHaveLength(0);
      expect(result.mitigated).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].findingId).toBe('CVE-2024-0003');
      expect(result.updated[0].prevSeverity).toBe('medium');
      expect(result.updated[0].newSeverity).toBe('high');
      expect(result.unchanged).toHaveLength(0);
    });

    it('should classify updated findings correctly (fixed version change)', () => {
      const oldFindings: NormalizedFinding[] = [
        {
          cveId: 'CVE-2024-0004',
          packageName: 'pkg-d',
          installedVersion: '3.0.0',
          severity: 'low',
          fixedVersion: undefined,
          source: 'free' as ScanSource,
        },
      ];

      const newFindings: NormalizedFinding[] = [
        {
          ...oldFindings[0],
          fixedVersion: '3.0.1',
        },
      ];

      const result = computeReimportDelta(oldFindings, newFindings);

      expect(result.new).toHaveLength(0);
      expect(result.mitigated).toHaveLength(0);
      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].findingId).toBe('CVE-2024-0004');
      expect(result.updated[0].prevFixVersion).toBeUndefined();
      expect(result.updated[0].newFixVersion).toBe('3.0.1');
      expect(result.unchanged).toHaveLength(0);
    });

    it('should classify unchanged findings correctly', () => {
      const finding: NormalizedFinding = {
        cveId: 'CVE-2024-0005',
        packageName: 'pkg-e',
        installedVersion: '4.0.0',
        severity: 'low',
        source: 'free' as ScanSource,
      };

      const result = computeReimportDelta([finding], [finding]);

      expect(result.new).toHaveLength(0);
      expect(result.mitigated).toHaveLength(0);
      expect(result.updated).toHaveLength(0);
      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0]).toBe(computeFingerprint(finding));
    });

    it('should handle a complex scenario with all change types', () => {
      const unchangedFinding: NormalizedFinding = {
        cveId: 'CVE-2024-0010',
        packageName: 'pkg-x',
        installedVersion: '1.0.0',
        severity: 'low',
        source: 'free' as ScanSource,
      };

      const mitigatedFinding: NormalizedFinding = {
        cveId: 'CVE-2024-0011',
        packageName: 'pkg-y',
        installedVersion: '2.0.0',
        severity: 'medium',
        source: 'free' as ScanSource,
      };

      const updatedFindingOld: NormalizedFinding = {
        cveId: 'CVE-2024-0012',
        packageName: 'pkg-z',
        installedVersion: '3.0.0',
        severity: 'high',
        source: 'free' as ScanSource,
      };

      const updatedFindingNew: NormalizedFinding = {
        ...updatedFindingOld,
        severity: 'critical',
      };

      const newFinding: NormalizedFinding = {
        cveId: 'CVE-2024-0013',
        packageName: 'pkg-w',
        installedVersion: '4.0.0',
        severity: 'critical',
        source: 'free' as ScanSource,
      };

      const oldFindings = [unchangedFinding, mitigatedFinding, updatedFindingOld];
      const newFindings = [unchangedFinding, updatedFindingNew, newFinding];

      const result = computeReimportDelta(oldFindings, newFindings);

      expect(result.new).toHaveLength(1);
      expect(result.new[0].cveId).toBe('CVE-2024-0013');

      expect(result.mitigated).toHaveLength(1);
      expect(result.mitigated[0].findingId).toBe('CVE-2024-0011');

      expect(result.updated).toHaveLength(1);
      expect(result.updated[0].findingId).toBe('CVE-2024-0012');
      expect(result.updated[0].newSeverity).toBe('critical');

      expect(result.unchanged).toHaveLength(1);
      expect(result.unchanged[0]).toBe(computeFingerprint(unchangedFinding));
    });
  });

  describe('computeFingerprint', () => {
    it('should generate consistent hashes for identical findings', () => {
      const finding: NormalizedFinding = {
        cveId: 'CVE-1234',
        packageName: 'pkg',
        installedVersion: '1.0',
        severity: 'low',
        source: 'free' as ScanSource,
      };

      const fp1 = computeFingerprint(finding);
      const fp2 = computeFingerprint({ ...finding });

      expect(fp1).toBe(fp2);
    });

    it('should generate different hashes for different findings', () => {
      const finding1: NormalizedFinding = {
        cveId: 'CVE-1234',
        packageName: 'pkg',
        installedVersion: '1.0',
        severity: 'low',
        source: 'free' as ScanSource,
      };

      const finding2: NormalizedFinding = {
        ...finding1,
        cveId: 'CVE-5678',
      };

      const fp1 = computeFingerprint(finding1);
      const fp2 = computeFingerprint(finding2);

      expect(fp1).not.toBe(fp2);
    });

    it('should ignore severity and fixedVersion in the hash', () => {
      const finding1: NormalizedFinding = {
        cveId: 'CVE-1234',
        packageName: 'pkg',
        installedVersion: '1.0',
        severity: 'low',
        fixedVersion: '1.1',
        source: 'free' as ScanSource,
      };

      const finding2: NormalizedFinding = {
        ...finding1,
        severity: 'high',
        fixedVersion: '1.2',
      };

      const fp1 = computeFingerprint(finding1);
      const fp2 = computeFingerprint(finding2);

      expect(fp1).toBe(fp2);
    });
  });

  describe('computeReimportSummary', () => {
    it('should correctly count the elements in ReimportResult', () => {
      const result = {
        new: [{} as NormalizedFinding],
        mitigated: [
          { findingId: 'id1', mitigatedAt: new Date(), mitigatedInScanId: 'scan1' },
          { findingId: 'id2', mitigatedAt: new Date(), mitigatedInScanId: 'scan1' },
        ],
        updated: [
          { findingId: 'id3', prevSeverity: 'low', newSeverity: 'high', changedAt: new Date() },
          { findingId: 'id4', prevSeverity: 'medium', newSeverity: 'high', changedAt: new Date() },
          { findingId: 'id5', prevSeverity: 'high', newSeverity: 'critical', changedAt: new Date() },
        ],
        unchanged: ['fp1', 'fp2', 'fp3', 'fp4'],
      };

      const summary = computeReimportSummary(result);

      expect(summary.newCount).toBe(1);
      expect(summary.mitigatedCount).toBe(2);
      expect(summary.updatedCount).toBe(3);
      expect(summary.unchangedCount).toBe(4);
    });
  });
});
