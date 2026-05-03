import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { buildDockerScannerArgs, runScannerTool } from '../../wasp-app/src/server/lib/scanners/scannerRuntime';

describe('scannerRuntime', () => {
  const originalRuntime = process.env.VIBESCAN_SCANNER_RUNTIME;
  let tempRoot: string;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(os.tmpdir(), 'vibescan-scanner-runtime-'));
  });

  afterEach(() => {
    process.env.VIBESCAN_SCANNER_RUNTIME = originalRuntime;
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('builds docker scanner args with hardened flags and mounted target path', () => {
    const sbomPath = join(tempRoot, 'sbom.json');
    writeFileSync(sbomPath, '{}');

    const args = buildDockerScannerArgs(sbomPath, 'anchore/grype:latest', ['grype', `sbom:${sbomPath}`, '-o', 'json']);

    expect(args).toEqual(
      expect.arrayContaining([
        'run',
        '--rm',
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt',
        'no-new-privileges',
        '--pids-limit',
        '64',
        '-w',
        '/work',
        'anchore/grype:latest',
        'grype',
        'sbom:/work/sbom.json',
        '-o',
        'json',
      ]),
    );
  });

  it('falls back to local execution when docker is unavailable in auto mode', () => {
    delete process.env.VIBESCAN_SCANNER_RUNTIME;

    const sbomPath = join(tempRoot, 'sbom.json');
    writeFileSync(sbomPath, '{}');

    const executor = jest.fn((command: string, args: string[]) => {
      if (command === 'docker') {
        throw new Error('docker not found');
      }

      expect(command).toBe('syft');
      expect(args).toEqual(['dir:' + sbomPath, '-o', 'cyclonedx-json']);
      return '{"artifacts": []}';
    });

    const result = runScannerTool(
      {
        tool: 'syft',
        targetPath: sbomPath,
        timeoutMs: 1000,
        dockerImage: 'anchore/syft:latest',
        localArgs: ['dir:' + sbomPath, '-o', 'cyclonedx-json'],
        dockerArgs: ['syft', `dir:${sbomPath}`, '-o', 'cyclonedx-json'],
      },
      executor,
    );

    expect(result).toBe('{"artifacts": []}');
    expect(executor).toHaveBeenCalledTimes(2);
    expect(executor.mock.calls[0][0]).toBe('docker');
    expect(executor.mock.calls[1][0]).toBe('syft');
  });

  it('uses docker when runtime is forced to docker', () => {
    process.env.VIBESCAN_SCANNER_RUNTIME = 'docker';

    const repoDir = mkdtempSync(join(tempRoot, 'repo-'));
    mkdirSync(repoDir, { recursive: true });

    const executor = jest.fn((command: string, args: string[]) => {
      expect(command).toBe('docker');
      expect(args).toEqual(expect.arrayContaining(['--network=none', '--read-only', 'anchore/syft:latest', 'syft']));
      return '{"artifacts": []}';
    });

    const result = runScannerTool(
      {
        tool: 'syft',
        targetPath: repoDir,
        timeoutMs: 1000,
        dockerImage: 'anchore/syft:latest',
        localArgs: ['dir:' + repoDir, '-o', 'cyclonedx-json'],
        dockerArgs: ['syft', `dir:${repoDir}`, '-o', 'cyclonedx-json'],
      },
      executor,
    );

    expect(result).toBe('{"artifacts": []}');
    expect(executor).toHaveBeenCalledTimes(1);
  });
});
