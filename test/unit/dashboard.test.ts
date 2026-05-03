/**
 * Unit tests for dashboard severity utilities
 */
import { describe, expect, it } from '@jest/globals';
import {
  normalizeSeverity,
  calculateSeverityBreakdown,
  breakdownToChartData,
  getSeverityColor,
  getSeverityBgColor,
  getSeverityBorderColor,
  formatRelativeTime,
  getStatusBadge,
  getScanTypeDisplay,
} from '../../wasp-app/src/client/utils/severity';

describe('Severity Utilities', () => {
  describe('normalizeSeverity', () => {
    it('should normalize severity strings', () => {
      expect(normalizeSeverity('CRITICAL')).toBe('critical');
      expect(normalizeSeverity('high')).toBe('high');
      expect(normalizeSeverity('MEDIUM')).toBe('medium');
      expect(normalizeSeverity('Low')).toBe('low');
      expect(normalizeSeverity('unknown')).toBe('info');
      expect(normalizeSeverity('')).toBe('info');
    });
  });

  describe('calculateSeverityBreakdown', () => {
    it('should calculate severity breakdown from scans', () => {
      const scans = [
        {
          findings: [
            { severity: 'critical' },
            { severity: 'high' },
            { severity: 'high' },
          ],
        },
        {
          findings: [
            { severity: 'medium' },
            { severity: 'low' },
          ],
        },
      ];

      const breakdown = calculateSeverityBreakdown(scans);

      expect(breakdown.critical).toBe(1);
      expect(breakdown.high).toBe(2);
      expect(breakdown.medium).toBe(1);
      expect(breakdown.low).toBe(1);
      expect(breakdown.info).toBe(0);
      expect(breakdown.total).toBe(5);
    });

    it('should handle scans with no findings', () => {
      const scans = [{ findings: [] }];
      const breakdown = calculateSeverityBreakdown(scans);

      expect(breakdown.total).toBe(0);
      expect(breakdown.critical).toBe(0);
    });

    it('should handle empty scans array', () => {
      const breakdown = calculateSeverityBreakdown([]);

      expect(breakdown.total).toBe(0);
      expect(breakdown.critical).toBe(0);
    });
  });

  describe('breakdownToChartData', () => {
    it('should convert breakdown to chart data', () => {
      const breakdown = {
        critical: 10,
        high: 20,
        medium: 30,
        low: 25,
        info: 15,
        total: 100,
      };

      const chartData = breakdownToChartData(breakdown);

      expect(chartData).toHaveLength(5);
      expect(chartData[0]).toEqual({
        name: 'Critical',
        value: 10,
        percentage: 10,
      });
      expect(chartData[1].name).toBe('High');
      expect(chartData[1].percentage).toBe(20);
    });

    it('should handle zero total', () => {
      const breakdown = {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
        total: 0,
      };

      const chartData = breakdownToChartData(breakdown);
      expect(chartData[0].percentage).toBe(0);
    });
  });

  describe('getSeverityColor', () => {
    it('should return correct color classes', () => {
      expect(getSeverityColor('critical')).toBe('text-red-500');
      expect(getSeverityColor('high')).toBe('text-orange-500');
      expect(getSeverityColor('medium')).toBe('text-yellow-500');
      expect(getSeverityColor('low')).toBe('text-green-500');
      expect(getSeverityColor('info')).toBe('text-gray-500');
    });
  });

  describe('getSeverityBgColor', () => {
    it('should return correct background classes', () => {
      expect(getSeverityBgColor('critical')).toBe('bg-red-500/10');
      expect(getSeverityBgColor('high')).toBe('bg-orange-500/10');
      expect(getSeverityBgColor('medium')).toBe('bg-yellow-500/10');
      expect(getSeverityBgColor('low')).toBe('bg-green-500/10');
      expect(getSeverityBgColor('info')).toBe('bg-gray-500/10');
    });
  });

  describe('getSeverityBorderColor', () => {
    it('should return correct border classes', () => {
      expect(getSeverityBorderColor('critical')).toBe('border-red-500/30');
      expect(getSeverityBorderColor('high')).toBe('border-orange-500/30');
      expect(getSeverityBorderColor('medium')).toBe('border-yellow-500/30');
      expect(getSeverityBorderColor('low')).toBe('border-green-500/30');
      expect(getSeverityBorderColor('info')).toBe('border-gray-500/30');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time strings', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 5 * 60 * 1000); // 5 minutes ago

      const result = formatRelativeTime(pastDate);
      expect(result).toContain('5m ago');
    });

    it('should handle string dates', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago

      const result = formatRelativeTime(pastDate.toISOString());
      expect(result).toContain('2h ago');
    });

    it('should handle just now', () => {
      const now = new Date();
      const result = formatRelativeTime(now);
      expect(result).toBe('just now');
    });

    it('should handle days', () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago

      const result = formatRelativeTime(pastDate);
      expect(result).toContain('3d ago');
    });
  });

  describe('getStatusBadge', () => {
    it('should return correct badge styles for different statuses', () => {
      const errorBadge = getStatusBadge('error');
      expect(errorBadge.color).toBe('text-red-500');
      expect(errorBadge.bg).toBe('bg-red-500/10');

      const doneBadge = getStatusBadge('done');
      expect(doneBadge.color).toBe('text-green-500');
      expect(doneBadge.bg).toBe('bg-green-500/10');

      const runningBadge = getStatusBadge('running');
      expect(runningBadge.color).toBe('text-blue-500');
      expect(runningBadge.bg).toBe('bg-blue-500/10');
    });

    it('should handle failed status', () => {
      const badge = getStatusBadge('failed');
      expect(badge.color).toBe('text-red-500');
    });

    it('should handle completed status', () => {
      const badge = getStatusBadge('completed');
      expect(badge.color).toBe('text-green-500');
    });
  });

  describe('getScanTypeDisplay', () => {
    it('should return correct display names', () => {
      expect(getScanTypeDisplay('github')).toBe('GitHub');
      expect(getScanTypeDisplay('github_app')).toBe('GitHub');
      expect(getScanTypeDisplay('sbom')).toBe('SBOM');
      expect(getScanTypeDisplay('sbom_upload')).toBe('SBOM');
      expect(getScanTypeDisplay('source_zip')).toBe('ZIP');
      expect(getScanTypeDisplay('zip')).toBe('ZIP');
      expect(getScanTypeDisplay('ci_plugin')).toBe('CI/CD');
      expect(getScanTypeDisplay('ci')).toBe('CI/CD');
      expect(getScanTypeDisplay('unknown')).toBe('unknown');
    });
  });
});
