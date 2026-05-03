import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { runJohnnyScanViaSsh, buildJohnnySshArgs } from '../../wasp-app/src/server/lib/scanners/codescoringJohnnyRuntime';
import { parseCodescoringResponse } from '../../wasp-app/src/server/lib/scanners/codescoringApiClient';

const trackedEnvKeys = [
  'CODESCORING_RUNTIME',
  'CODESCORING_SSH_HOST',
  'CODESCORING_SSH_USER',
  'CODESCORING_SSH_PORT',
  'CODESCORING_SSH_IDENTITY_FILE',
  'CODESCORING_SSH_REMOTE_TMP_DIR',
  'CODESCORING_JOHNNY_COMMAND',
];

function resetTrackedEnv() {
  for (const key of trackedEnvKeys) {
    delete process.env[key];
  }
}

describe('codescoringJohnnyRuntime', () => {
  afterEach(() => {
    resetTrackedEnv();
  });

  it('builds ssh args and remote shell command with hardened defaults', () => {
    const config = {
      host: 'johnny.codescoring.internal',
      user: 'scanner',
      port: 2222,
      identityFile: '/home/virus/.ssh/johnny',
      commandTemplate: 'johnny scan --format json --no-summary --bom-path "$VIBESCAN_BOM_PATH"',
      remoteTempDir: '/var/tmp',
    };

    const args = buildJohnnySshArgs(config, 'set -euo pipefail; export VIBESCAN_BOM_PATH=/tmp/vibescan.json');

    expect(args).toEqual(
      expect.arrayContaining([
        '-T',
        '-o',
        'BatchMode=yes',
        '-o',
        'StrictHostKeyChecking=accept-new',
        '-o',
        'ServerAliveInterval=15',
        '-o',
        'ServerAliveCountMax=2',
        '-p',
        '2222',
        '-i',
        '/home/virus/.ssh/johnny',
        'scanner@johnny.codescoring.internal',
      ]),
    );
  });

  it('accepts exit code 1 and preserves JSON output for findings', () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    process.env.CODESCORING_SSH_USER = 'scanner';
    process.env.CODESCORING_SSH_COMMAND = 'johnny scan --format json --no-summary --bom-path "$VIBESCAN_BOM_PATH"';

    const executor = jest.fn(() => ({
      status: 1,
      stdout: JSON.stringify({
        vulnerabilities: [
          {
            cveId: 'CVE-2026-0001',
            severity: 'high',
            packageName: 'lodash',
            version: '4.17.21',
            fixedVersion: '4.17.22',
            description: 'Known issue',
            cvssScore: 7.5,
          },
        ],
      }),
      stderr: 'issues found',
      error: null,
    }));

    const rawOutput = runJohnnyScanViaSsh(
      [{ name: 'lodash', version: '4.17.21' }],
      'scan-123',
      1000,
      executor,
    );

    const findings = parseCodescoringResponse(JSON.parse(rawOutput));
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      cveId: 'CVE-2026-0001',
      severity: 'high',
      package: 'lodash',
      version: '4.17.21',
      fixedVersion: '4.17.22',
      source: 'enterprise',
    });
  });

  it('returns an empty result for exit code 3 when the remote CLI emits no JSON', () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    process.env.CODESCORING_SSH_COMMAND = 'johnny scan --format json --no-summary --bom-path "$VIBESCAN_BOM_PATH"';

    const executor = jest.fn(() => ({
      status: 3,
      stdout: '',
      stderr: 'successful run, no result',
      error: null,
    }));

    const rawOutput = runJohnnyScanViaSsh(
      [{ name: 'express', version: '4.18.2' }],
      'scan-456',
      1000,
      executor,
    );

    expect(JSON.parse(rawOutput)).toEqual({ vulnerabilities: [] });
  });

  it('throws for exit code 5 BOM validation failures', () => {
    process.env.CODESCORING_SSH_HOST = 'johnny.codescoring.internal';
    process.env.CODESCORING_SSH_COMMAND = 'johnny scan --format json --no-summary --bom-path "$VIBESCAN_BOM_PATH"';

    const executor = jest.fn(() => ({
      status: 5,
      stdout: '',
      stderr: 'BOM validation failed',
      error: null,
    }));

    expect(() =>
      runJohnnyScanViaSsh(
        [{ name: 'express', version: '4.18.2' }],
        'scan-789',
        1000,
        executor,
      ),
    ).toThrow(/BOM validation failed/i);
  });

  it('parses component-shaped CodeScoring responses', () => {
    const findings = parseCodescoringResponse({
      components: [
        {
          name: 'lodash',
          version: '4.17.21',
          vulnerabilities: [
            {
              cveId: 'CVE-2026-0010',
              severity: 'critical',
              fixedVersion: '4.17.22',
              description: 'Component-shaped response',
              cvssScore: 9.8,
            },
          ],
        },
      ],
    });

    expect(findings).toEqual([
      expect.objectContaining({
        cveId: 'CVE-2026-0010',
        severity: 'critical',
        package: 'lodash',
        version: '4.17.21',
        fixedVersion: '4.17.22',
      }),
    ]);
  });
});

