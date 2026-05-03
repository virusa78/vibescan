import { mapRecentScans } from '../src/server/operations/dashboard/recentScanMapper';

describe('mapRecentScans', () => {
  test('uses persisted finding counts for dashboard scans', () => {
    expect(
      mapRecentScans([
        {
          id: 'scan-1',
          status: 'done',
          inputType: 'github_app',
          inputRef: 'acme/vibescan',
          planAtSubmission: 'pro',
          createdAt: new Date('2026-04-20T10:00:00.000Z'),
          completedAt: new Date('2026-04-20T10:05:00.000Z'),
          _count: { findings: 17 },
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        id: 'scan-1',
        status: 'done',
        inputType: 'github_app',
        inputRef: 'acme/vibescan',
        planAtSubmission: 'pro',
        vulnerability_count: 17,
      }),
    ]);
  });
});
