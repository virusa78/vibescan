import { describe, expect, it } from '@jest/globals';
import { buildFindingGroups } from '../../wasp-app/src/server/operations/findings/grouping';

const sampleFindings = [
  {
    id: '1',
    project: { id: 'project-1', name: 'Project One', targetType: 'github', targetRef: 'openai/example' },
    cveId: 'CVE-2026-1111',
    packageName: 'lodash',
    installedVersion: '4.17.20',
    filePath: 'package-lock.json',
    severity: 'high' as const,
    status: 'active' as const,
    ageDays: 3,
    activeDays: 3,
  },
  {
    id: '2',
    project: { id: 'project-2', name: 'Project Two', targetType: 'github', targetRef: 'openai/other' },
    cveId: 'CVE-2026-1111',
    packageName: 'lodash',
    installedVersion: '4.17.20',
    filePath: 'package-lock.json',
    severity: 'low' as const,
    status: 'mitigated' as const,
    ageDays: 18,
    activeDays: 10,
  },
  {
    id: '3',
    project: { id: 'project-1', name: 'Project One', targetType: 'github', targetRef: 'openai/example' },
    cveId: 'CVE-2026-2222',
    packageName: 'react',
    installedVersion: '18.2.0',
    filePath: 'src/package.json',
    severity: 'critical' as const,
    status: 'active' as const,
    ageDays: 2,
    activeDays: 2,
  },
];

describe('findings grouping', () => {
  it('groups findings by project', () => {
    const groups = buildFindingGroups(sampleFindings, 'project');

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: 'project-1',
      type: 'project',
      title: 'Project One',
      subtitle: 'openai/example',
      count: 2,
      activeCount: 2,
      criticalHighCount: 2,
    });
  });

  it('groups findings by CVE', () => {
    const groups = buildFindingGroups(sampleFindings, 'cve');

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: 'CVE-2026-1111',
      type: 'cve',
      title: 'CVE-2026-1111',
      count: 2,
      activeCount: 1,
      criticalHighCount: 1,
    });
    expect(groups[0].subtitle).toContain('2 projects');
  });
});
