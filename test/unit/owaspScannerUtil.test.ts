import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { execFileSync, execSync, execFile, exec } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { rm } from 'fs/promises';
import {
  getOwaspCommand,
  isOwaspInstalled,
  executeOwaspCli,
  scanWithOwaspDetailed,
} from '../../wasp-app/src/server/lib/scanners/owaspScannerUtil';

jest.mock('child_process', () => ({
  execSync: jest.fn(),
  execFileSync: jest.fn(),
  execFile: jest.fn((file: any, args: any, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(null, { stdout: '', stderr: '' });
  }),
  exec: jest.fn((command: any, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback;
    if (cb) cb(null, { stdout: '', stderr: '' });
  }),
}));

import { execFile, exec } from 'child_process';
const mockExecFile = execFile as unknown as jest.Mock;
const mockExec = exec as unknown as jest.Mock;

// Mock fs
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  mkdtempSync: jest.fn(),
  readFileSync: jest.fn(),
  rmSync: jest.fn(),
}));

jest.mock('fs/promises', () => ({
  rm: jest.fn(() => Promise.resolve()),
}));

// Mock external services
jest.mock('../../wasp-app/src/server/services/githubAppService.js', () => ({
  createGitHubInstallationAccessToken: jest.fn().mockImplementation(() => Promise.resolve('fake-github-token')) as any,
}));

jest.mock('../../wasp-app/src/server/services/inputAdapterService.js', () => ({
  resolveTrustedScanInputPath: jest.fn().mockImplementation((p: any) => p),
  validateGitHubUrl: jest.fn().mockReturnValue({ owner: 'test-owner', repo: 'test-repo' }),
}));

jest.mock('../../wasp-app/src/server/operations/scans/normalizeFindings.js', () => ({
  normalizeOwaspFindings: jest.fn().mockReturnValue([
    {
      id: 'CVE-1234',
      title: 'Mock Vulnerability',
      description: 'Mock Description',
      severity: 'high',
      cvssScore: 8.5,
    },
  ]),
}));

const mockExecSync = execSync as jest.Mock;
const mockExecFileSync = execFileSync as jest.Mock;
const mockRmMock = rm as unknown as jest.Mock;
const mockExistsSync = existsSync as jest.Mock;
const mockMkdirSync = mkdirSync as jest.Mock;
const mockMkdtempSync = mkdtempSync as jest.Mock;
const mockReadFileSync = readFileSync as jest.Mock;
const mockRmSync = rmSync as jest.Mock;

describe('owaspScannerUtil', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{}');
    
    mockExecFile.mockImplementation((file: string, args: string[], options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback;
      if (file === 'docker' && args.includes('--version')) {
        if (cb) cb(null, { stdout: 'docker version 20.10.7', stderr: '' });
      } else if (file === 'docker' && args.includes('run') && args.includes('--version')) {
        if (cb) cb(null, { stdout: 'dependency-check version 8.0.0', stderr: '' });
      } else if (file === 'git') {
        if (cb) cb(null, { stdout: 'git clone done', stderr: '' });
      } else if (file === 'python3') {
        if (cb) cb(null, { stdout: 'zip extracted', stderr: '' });
      } else if (file === 'dependency-check') {
        if (cb) cb(null, { stdout: 'dependency-check version 8.0.0', stderr: '' });
      } else {
        if (cb) cb(null, { stdout: 'SUCCESS', stderr: '' });
      }
    });

    mockExec.mockImplementation((command: string, options: any, callback: any) => {
      const cb = typeof options === 'function' ? options : callback;
      if (cb) cb(null, { stdout: 'SUCCESS', stderr: '' });
    });

    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('--version')) {
        return 'dependency-check version 8.0.0';
      }
      return Buffer.from('SUCCESS');
    });

    mockExecFileSync.mockImplementation((cmd: string, args: string[]) => {
      if (cmd === 'docker' && args.includes('--version')) {
        return Buffer.from('docker version 20.10.7');
      }
      if (cmd === 'docker' && args.includes('run') && args.includes('--version')) {
        return Buffer.from('dependency-check version 8.0.0');
      }
      if (cmd === 'git') {
        return Buffer.from('git clone done');
      }
      if (cmd === 'python3') {
        return Buffer.from('zip extracted');
      }
      return Buffer.from('SUCCESS');
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('getOwaspCommand', () => {
    it('uses OWASP_COMMAND when provided', () => {
      expect(getOwaspCommand({
        OWASP_COMMAND: '/opt/dependency-check/bin/dependency-check.sh',
      } as NodeJS.ProcessEnv)).toBe('/opt/dependency-check/bin/dependency-check.sh');
    });

    it('defaults to dependency-check', () => {
      expect(getOwaspCommand({} as NodeJS.ProcessEnv)).toBe('dependency-check');
    });
  });

  describe('isOwaspInstalled', () => {
    it('returns true when version command succeeds', async () => {
      mockExecFile.mockImplementationOnce((file: any, args: any, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        if (cb) cb(null, { stdout: 'dependency-check version 8.0.0', stderr: '' });
      });
      expect(await isOwaspInstalled()).toBe(true);
    });

    it('returns false when version command fails with ENOENT', async () => {
      const error: any = new Error('not found');
      error.code = 'ENOENT';
      mockExecFile.mockImplementationOnce((file: any, args: any, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        if (cb) cb(error);
      });
      expect(await isOwaspInstalled()).toBe(false);
    });

    it('returns true when command fails with other errors', async () => {
      mockExecFile.mockImplementationOnce((file: any, args: any, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        if (cb) cb(new Error('generic error'));
      });
      expect(await isOwaspInstalled()).toBe(true);
    });
  });

  describe('executeOwaspCli', () => {
    it('executes CLI and reads report successfully', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        reportVersion: '8.0.0',
        appName: 'test-app',
        vulnerabilities: [],
      }));

      const result = await executeOwaspCli('/target/path', 'test-project', 5000);
      expect(result.appName).toBe('test-app');
      expect(mockExec).toHaveBeenCalledWith(
        expect.stringContaining('dependency-check --project "test-project" --scan "/target/path"'),
        expect.any(Object),
        expect.any(Function)
      );
    });

    it('throws error when CLI execution fails', async () => {
      const execError: any = new Error('Command failed');
      execError.stdout = 'stdout logs';
      execError.stderr = 'stderr logs';
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        if (cb) cb(execError);
      });

      await expect(executeOwaspCli('/target/path', 'test-project')).rejects.toThrow('Failed to execute OWASP');
    });

    it('handles timeout correctly', async () => {
      const execError: any = new Error('Command timed out');
      execError.message = 'Command timed out after 1000ms';
      mockExec.mockImplementationOnce((command: string, options: any, callback: any) => {
        const cb = typeof options === 'function' ? options : callback;
        if (cb) cb(execError);
      });

      await expect(executeOwaspCli('/target/path', 'test-project', 1000)).rejects.toThrow('Command timed out');
    });
  });

  describe('scanWithOwaspDetailed', () => {
    it('runs local command scan when local command is installed', async () => {
      process.env.OWASP_RUNTIME = 'local';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        reportVersion: '8.0.0',
        appName: 'test-app',
        vulnerabilities: [],
      }));

      const result = await scanWithOwaspDetailed([], 'scan-1', {
        inputType: 'sbom_upload',
        inputRef: 'sbom.json',
      });

      expect(result.owaspVersion).toBe('8.0.0');
      expect(result.rawOutput).toBeDefined();
    });

    it('runs docker command scan when local is unavailable and docker is available', async () => {
      process.env.OWASP_RUNTIME = 'docker';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        reportVersion: '8.0.0',
        appName: 'test-app',
        vulnerabilities: [],
      }));

      const result = await scanWithOwaspDetailed([], 'scan-2', {
        inputType: 'sbom_upload',
        inputRef: 'sbom.json',
      });

      expect(result.owaspVersion).toBe('8.0.0');
      expect(mockExecFile).toHaveBeenCalledWith('docker', expect.arrayContaining(['run', '--rm']), expect.any(Object), expect.any(Function));
    });

    it('runs docker app cloning and cleanup for github_app scan', async () => {
      process.env.OWASP_RUNTIME = 'docker';
      mockMkdtempSync.mockReturnValue('/tmp/test-temp-dir');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        reportVersion: '8.0.0',
        appName: 'test-app',
        vulnerabilities: [],
      }));

      const result = await scanWithOwaspDetailed([], 'scan-3', {
        inputType: 'github_app',
        inputRef: 'https://github.com/test-owner/test-repo',
        githubContext: {
          installationId: '12345',
          branch: 'main',
          commitSha: 'abcdef',
          ref: 'refs/heads/main',
        } as any,
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockRmMock).toHaveBeenCalledWith('/tmp/test-temp-dir', expect.objectContaining({ recursive: true }));
    });

    it('runs zip extraction using python3 for source_zip scan', async () => {
      process.env.OWASP_RUNTIME = 'docker';
      mockMkdtempSync.mockReturnValue('/tmp/test-zip-dir');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({
        reportVersion: '8.0.0',
        appName: 'test-app',
        vulnerabilities: [],
      }));

      const result = await scanWithOwaspDetailed([], 'scan-4', {
        inputType: 'source_zip',
        inputRef: 'source.zip',
      });

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(mockExecFile).toHaveBeenCalledWith('python3', expect.arrayContaining(['-c']), expect.any(Function));
      expect(mockRmMock).toHaveBeenCalledWith('/tmp/test-zip-dir', expect.objectContaining({ recursive: true }));
    });
  });
});
