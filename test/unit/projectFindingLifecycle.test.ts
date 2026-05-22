import { describe, expect, it } from '@jest/globals';
import {
  buildProjectFindingFingerprint,
  calculateSlaDueAt,
  calculateSlaState,
  normalizeProjectTarget,
} from '../../wasp-app/src/server/services/projectFindingLifecycleService';

describe('project finding lifecycle helpers', () => {
  it('normalizes GitHub URLs to stable owner/repo project identity', () => {
    const target = normalizeProjectTarget('github', 'https://github.com/OpenAI/Example.git');

    expect(target).toMatchObject({
      name: 'OpenAI/Example',
      slug: 'openai-example',
      targetType: 'github',
      normalizedTargetRef: 'openai/example',
    });
  });

  it('normalizes upload inputs from filenames', () => {
    const target = normalizeProjectTarget('sbom_upload', '/tmp/uploads/service-a.cdx.json');

    expect(target.name).toBe('service-a.cdx');
    expect(target.targetType).toBe('sbom');
    expect(target.normalizedTargetRef).toBe('sbom:/tmp/uploads/service-a.cdx.json');
  });

  it('uses CVE package version and path for stable aggregate fingerprints', () => {
    const first = buildProjectFindingFingerprint({
      cveId: 'CVE-2026-1234',
      package: 'lodash',
      version: '4.17.20',
      filePath: './package-lock.json',
    });
    const second = buildProjectFindingFingerprint({
      cveId: 'CVE-2026-1234',
      package: 'lodash',
      version: '4.17.20',
      filePath: 'package-lock.json',
    });

    expect(first).toBe(second);
  });

  it('calculates severity based SLA state', () => {
    const firstSeenAt = new Date('2026-05-01T00:00:00.000Z');
    const criticalDueAt = calculateSlaDueAt('CRITICAL', firstSeenAt);

    expect(criticalDueAt?.toISOString()).toBe('2026-05-08T00:00:00.000Z');
    expect(calculateSlaState(criticalDueAt, new Date('2026-05-09T00:00:00.000Z'))).toBe('overdue');
    expect(calculateSlaState(criticalDueAt, new Date('2026-05-03T00:00:00.000Z'))).toBe('due_soon');
    expect(calculateSlaDueAt('INFO', firstSeenAt)).toBeNull();
  });
});
