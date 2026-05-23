import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { runVibeScanCIGate, toExitCode } from '../../scripts/vibescan-ci-gate';

describe('vibescan-ci-gate exit mapping', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.GITHUB_STEP_SUMMARY;
  });

  it('maps pass to exit code 0', () => {
    expect(toExitCode('pass')).toBe(0);
  });

  it('maps fail to exit code 1', () => {
    expect(toExitCode('fail')).toBe(1);
  });

  it('submits, polls, fetches a passing decision, and exits 0', async () => {
    const fetchMock = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'scan-1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'done' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            scanId: 'scan-1',
            decision: 'pass',
            reason: 'No findings at or above CRITICAL',
            blockingIssues: 0,
            blockingIssuesBySource: {},
            effectiveThreshold: 'CRITICAL',
            scanUrl: 'https://app.vibescan.example/scans/scan-1',
            reportUrl: 'https://app.vibescan.example/reports/scan-1',
            policySource: 'default',
          }),
          { status: 200 },
        ),
      );

    const exitCode = await runVibeScanCIGate({
      apiBaseUrl: 'https://app.vibescan.example',
      apiKey: 'api-key',
      repositoryUrl: 'https://github.com/acme/repo',
      pollIntervalMs: 1,
      timeoutMs: 100,
    });

    expect(exitCode).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns exit code 1 when the decision fails', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'scan-2' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: 'done' }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            scanId: 'scan-2',
            decision: 'fail',
            reason: '1 finding at or above HIGH (grype: 1)',
            blockingIssues: 1,
            blockingIssuesBySource: { grype: 1 },
            effectiveThreshold: 'HIGH',
            scanUrl: 'https://app.vibescan.example/scans/scan-2',
            reportUrl: 'https://app.vibescan.example/reports/scan-2',
            policySource: 'github_installation',
          }),
          { status: 200 },
        ),
      );

    const exitCode = await runVibeScanCIGate({
      apiBaseUrl: 'https://app.vibescan.example',
      apiKey: 'api-key',
      repositoryUrl: 'https://github.com/acme/repo',
      pollIntervalMs: 1,
      timeoutMs: 100,
    });

    expect(exitCode).toBe(1);
  });
});
