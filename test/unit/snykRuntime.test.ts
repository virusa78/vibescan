import { afterEach, describe, expect, it } from '@jest/globals';
import type { SnykRuntimeExecutor } from '../../wasp-app/src/server/lib/scanners/snykTypes';
import { runSnykScan } from '../../wasp-app/src/server/lib/scanners/snykRuntime';

const trackedEnv = {
  SNYK_RUNTIME: process.env.SNYK_RUNTIME,
  SNYK_COMMAND: process.env.SNYK_COMMAND,
  VIBESCAN_SNYK_CREDENTIAL_MODE: process.env.VIBESCAN_SNYK_CREDENTIAL_MODE,
};

describe('snykRuntime', () => {
  afterEach(() => {
    process.env.SNYK_RUNTIME = trackedEnv.SNYK_RUNTIME;
    process.env.SNYK_COMMAND = trackedEnv.SNYK_COMMAND;
    process.env.VIBESCAN_SNYK_CREDENTIAL_MODE = trackedEnv.VIBESCAN_SNYK_CREDENTIAL_MODE;
  });

  it('executes local snyk command with provided credentials and parses vulnerabilities', async () => {
    process.env.SNYK_RUNTIME = 'local';
    process.env.SNYK_COMMAND = 'snyk sbom test --file="$VIBESCAN_BOM_PATH" --json';

    const executor: SnykRuntimeExecutor = (_command, args, input, _timeoutMs, env) => {
      expect(args[0]).toBe('-lc');
      expect(input).toContain('"bomFormat": "CycloneDX"');
      expect(env?.SNYK_TOKEN).toBe('user-snyk-token');
      expect(env?.SNYK_ORG_ID).toBe('org-42');

      return {
        status: 1,
        stdout: JSON.stringify({
          vulnerabilities: [
            {
              id: 'SNYK-JS-LODASH-1',
              severity: 'high',
              packageName: 'lodash',
              version: '4.17.20',
              fixedIn: ['4.17.21'],
              description: 'Prototype pollution',
              identifiers: {
                CVE: ['CVE-2024-9999'],
              },
              cvssScore: 7.5,
            },
          ],
        }),
        stderr: '',
        error: null,
      };
    };

    const result = await runSnykScan(
      [{ name: 'lodash', version: '4.17.20' }],
      'scan-1',
      {
        source: 'user-secret',
        userId: 'user-1',
        values: {
          token: 'user-snyk-token',
          orgId: 'org-42',
        },
      },
      executor,
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        cveId: 'CVE-2024-9999',
        package: 'lodash',
        version: '4.17.20',
        fixedVersion: '4.17.21',
        severity: 'high',
        source: 'snyk',
      }),
    ]);
  });

  it('returns empty findings in mock mode', async () => {
    process.env.SNYK_RUNTIME = 'mock';

    const result = await runSnykScan(
      [{ name: 'express', version: '4.18.2' }],
      'scan-2',
      {
        source: 'environment',
        values: {
          token: 'env-token',
        },
      },
    );

    expect(result.findings).toEqual([]);
    expect(result.rawOutput).toEqual({ ok: true, vulnerabilities: [] });
  });
});
