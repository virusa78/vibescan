/**
 * OWASP Dependency-Check Scanner Utility - executes Dependency-Check in Docker
 */

import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'fs';
import { rm } from 'fs/promises';
import { join, resolve } from 'path';
import { tmpdir } from 'os';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { normalizeOwaspFindings, type NormalizedFinding } from '../../operations/scans/normalizeFindings.js';
import { createGitHubInstallationAccessToken, type PersistedGitHubScanContext } from '../../services/githubAppService.js';
import { resolveTrustedScanInputPath, validateGitHubUrl } from '../../services/inputAdapterService.js';

const execPromise = promisify(exec);
const execFilePromise = promisify(execFile);

export interface OwaspVulnerability {
  name: string;
  version: string;
  cve: string;
  cvssScore: number;
  severity: string;
  description: string;
  source: 'owasp';
}

export type OwaspScanResult = {
  reportVersion: string;
  appName: string;
  appVersion?: string;
  reportDate: string;
  vulnerabilities: OwaspVulnerability[];
};

type OwaspScanContext = {
  inputType: 'github_app' | 'source_zip' | 'sbom_upload';
  inputRef: string;
  githubContext?: PersistedGitHubScanContext | null;
};

export function getOwaspCommand(env: NodeJS.ProcessEnv = process.env): string {
  return env.OWASP_COMMAND?.trim() || 'dependency-check';
}

async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFilePromise('docker', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function getRuntimeMode(env: NodeJS.ProcessEnv = process.env): 'docker' | 'local' | 'auto' {
  const value = env.OWASP_RUNTIME?.trim().toLowerCase();
  if (value === 'docker' || value === 'local') {
    return value;
  }
  return 'auto';
}

function getDockerImage(env: NodeJS.ProcessEnv = process.env): string {
  return env.VIBESCAN_OWASP_IMAGE?.trim() || 'owasp/dependency-check:latest';
}

function getDataDirectory(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.OWASP_DATA_DIRECTORY?.trim() || join(process.cwd(), '.cache', 'owasp', 'data'));
}

function getReportDirectory(scanId: string, env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.OWASP_REPORTS_DIRECTORY?.trim() || join(process.cwd(), '.cache', 'owasp', 'reports', scanId));
}

function getUserLabel(env: NodeJS.ProcessEnv = process.env): string {
  return env.USER?.trim() || 'vibescan';
}

function getUidGid(): string | null {
  if (typeof process.getuid !== 'function' || typeof process.getgid !== 'function') {
    return null;
  }

  return `${process.getuid()}:${process.getgid()}`;
}

function isOwaspMissingError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return /dependency-check/i.test(message) && /(not found|enoent)/i.test(message);
}

function logOwaspStage(scope: string, stage: string, details?: unknown): void {
  if (details === undefined) {
    console.log(`[OWASP / ${scope}] ${stage}`);
    return;
  }

  console.log(`[OWASP / ${scope}] ${stage}`, details);
}

export async function isOwaspInstalled(): Promise<boolean> {
  try {
    await execFilePromise(getOwaspCommand(), ['--version'], { timeout: 5000 });
    return true;
  } catch (error) {
    return !isOwaspMissingError(error);
  }
}

function buildDockerArgs(scanPath: string, reportDir: string, dataDir: string, projectName: string): string[] {
  const uidGid = getUidGid();
  const args = [
    'run',
    '--rm',
    '-e',
    `user=${getUserLabel()}`,
  ];

  if (uidGid) {
    args.push('-u', uidGid);
  }

  if (process.env.NVD_API_KEY) {
    args.push('-e', `NVD_API_KEY=${process.env.NVD_API_KEY}`);
  }

  args.push(
    '--volume',
    `${scanPath}:/src:z`,
    '--volume',
    `${dataDir}:/usr/share/dependency-check/data:z`,
    '--volume',
    `${reportDir}:/report:z`,
    getDockerImage(),
    '--scan',
    '/src',
    '--format',
    'ALL',
    '--project',
    projectName,
    '--out',
    '/report',
  );

  if (process.env.OWASP_NO_UPDATE === 'true') {
    args.push('--noupdate');
  }

  if (process.env.NVD_API_KEY) {
    args.push('--nvdApiKey', process.env.NVD_API_KEY);
  }

  return args;
}

async function prepareScanPath(context: OwaspScanContext): Promise<{ scanPath: string; cleanup: (() => Promise<void>) | null }> {
  if (context.inputType === 'github_app') {
    const { owner, repo } = validateGitHubUrl(context.inputRef);
    const tempRoot = mkdtempSync(join(tmpdir(), 'vibescan-owasp-github-'));
    const repoPath = join(tempRoot, `${owner}-${repo}`);
    const branchName = context.githubContext?.branch || context.githubContext?.ref?.replace(/^refs\/heads\//, '') || undefined;
    const commitSha = context.githubContext?.commitSha || undefined;
    const authCloneUrl =
      context.githubContext?.installationId
        ? `https://x-access-token:${await createGitHubInstallationAccessToken(context.githubContext.installationId)}@github.com/${owner}/${repo}.git`
        : context.inputRef;

    try {
      logOwaspStage(context.inputRef, 'cloning GitHub repo', {
        owner,
        repo,
        branchName,
        commitSha,
        repoPath,
      });
      const cloneArgs = [
        'clone',
        '--depth',
        '1',
        '--filter=blob:none',
        '--quiet',
        ...(branchName ? ['--branch', branchName] : []),
        authCloneUrl,
        repoPath,
      ];
      await execFilePromise('git', cloneArgs);

      if (commitSha) {
        try {
          logOwaspStage(context.inputRef, 'checking out commit', { commitSha });
          await execFilePromise('git', ['fetch', '--depth', '1', 'origin', commitSha], { cwd: repoPath });
          await execFilePromise('git', ['checkout', '--quiet', commitSha], { cwd: repoPath });
        } catch {
          // Best effort; the branch checkout is usually enough for OWASP scans.
        }
      }
    } catch (error) {
      await rm(tempRoot, { recursive: true, force: true });
      throw new Error(`Failed to clone GitHub repo for OWASP scan: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      scanPath: repoPath,
      cleanup: () => rm(tempRoot, { recursive: true, force: true }),
    };
  }

  const candidate = resolveTrustedScanInputPath(context.inputRef);
  if (context.inputType === 'source_zip' && candidate.toLowerCase().endsWith('.zip')) {
    const tempRoot = mkdtempSync(join(tmpdir(), 'vibescan-owasp-zip-'));
    const extractDir = join(tempRoot, 'source');
    mkdirSync(extractDir, { recursive: true });

    try {
      logOwaspStage(context.inputRef, 'extracting source zip', { candidate, extractDir });
      await execFilePromise('python3', [
        '-c',
        'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
        candidate,
        extractDir,
      ]);
    } catch (error) {
      await rm(tempRoot, { recursive: true, force: true });
      throw new Error(`Failed to extract source ZIP for OWASP scan: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      scanPath: extractDir,
      cleanup: () => rm(tempRoot, { recursive: true, force: true }),
    };
  }

  return {
    scanPath: candidate,
    cleanup: null,
  };
}

function readDependencyCheckReport(reportDir: string): OwaspScanResult {
  const reportPath = resolve(reportDir, 'dependency-check-report.json');
  if (!existsSync(reportPath)) {
    throw new Error('OWASP report not generated');
  }

  return JSON.parse(readFileSync(reportPath, 'utf-8')) as OwaspScanResult;
}

/**
 * Execute OWASP Dependency-Check and parse JSON output
 */
export async function executeOwaspCli(
  targetPath: string,
  projectName: string,
  timeoutMs: number = 600000, // 10 minutes - Dependency-Check can be slow
  command: string = getOwaspCommand(),
): Promise<OwaspScanResult> {
  const reportDir = resolve(tmpdir(), `vibescan-owasp-${Date.now()}`);
  mkdirSync(reportDir, { recursive: true });

  let commandLine = `${command} --project "${projectName}" --scan "${targetPath}" --format JSON --out "${reportDir}"`;
  
  if (process.env.OWASP_NO_UPDATE === 'true') {
    commandLine += ' --noupdate';
  }
  if (process.env.NVD_API_KEY) {
    commandLine += ` --nvdApiKey "${process.env.NVD_API_KEY}"`;
  }

  logOwaspStage(projectName, 'starting CLI execution', {
    targetPath,
    reportDir,
    timeoutMs,
    commandLine,
  });

  try {
    await execPromise(commandLine, {
      timeout: timeoutMs,
      maxBuffer: 20 * 1024 * 1024, // 20MB
    });

    logOwaspStage(projectName, 'CLI finished, reading report', { reportDir });
    const parsed = readDependencyCheckReport(reportDir);
    logOwaspStage(projectName, 'report parsed', {
      reportVersion: parsed.reportVersion,
      vulnerabilities: Array.isArray(parsed.vulnerabilities) ? parsed.vulnerabilities.length : 0,
    });

    // Cleanup
    try {
      await rm(reportDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    return parsed;
  } catch (error) {
    // Cleanup on error
    try {
      await rm(reportDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }

    if (error instanceof Error && error.message.includes('timed out')) {
      throw error;
    } else {
      const stdout = error && typeof error === 'object' && 'stdout' in error ? String((error as any).stdout ?? '') : '';
      const stderr = error && typeof error === 'object' && 'stderr' in error ? String((error as any).stderr ?? '') : '';
      logOwaspStage(projectName, 'CLI execution failed', {
        error: error instanceof Error ? error.message : String(error),
        stdout: stdout.slice(0, 2000),
        stderr: stderr.slice(0, 2000),
      });
      throw new Error(
        `Failed to execute OWASP: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export type OwaspScanRun = {
  rawOutput: NormalizedFinding[];
  durationMs: number;
  owaspVersion?: string;
};

/**
 * Scan with OWASP Dependency-Check
 */
export async function scanWithOwaspDetailed(
  _components: NormalizedComponent[],
  scanId: string,
  context?: OwaspScanContext,
): Promise<OwaspScanRun> {
  const startTime = Date.now();
  const runtimeMode = getRuntimeMode();
  const reportDir = getReportDirectory(scanId);
  const dataDir = getDataDirectory();
  let scanTarget: { scanPath: string; cleanup: (() => Promise<void>) | null } | null = null;

  try {
    logOwaspStage(scanId, 'scan starting', {
      inputType: context?.inputType ?? 'unknown',
      inputRef: context?.inputRef ?? 'unknown',
      runtimeMode,
      reportDir,
      dataDir,
    });
    mkdirSync(reportDir, { recursive: true });
    mkdirSync(dataDir, { recursive: true });

    if (context && context.inputType !== 'sbom_upload') {
      logOwaspStage(scanId, 'preparing scan target');
      scanTarget = await prepareScanPath(context);
    } else {
      const fallbackDir = resolve(tmpdir(), `vibescan-owasp-${scanId}`);
      if (!existsSync(fallbackDir)) {
        mkdirSync(fallbackDir, { recursive: true });
      }
      logOwaspStage(scanId, 'using fallback scan target', { fallbackDir });
      scanTarget = {
        scanPath: fallbackDir,
        cleanup: () => rm(fallbackDir, { recursive: true, force: true }),
      };
    }

    logOwaspStage(scanId, 'scan target ready', {
      scanPath: scanTarget.scanPath,
      hasCleanup: Boolean(scanTarget.cleanup),
    });

    const localCommandAvailable = await isOwaspInstalled();
    let owaspOutput: OwaspScanResult;
    if (runtimeMode === 'local' || (runtimeMode === 'auto' && localCommandAvailable)) {
      logOwaspStage(scanId, 'running local OWASP command', {
        command: getOwaspCommand(),
        scanPath: scanTarget.scanPath,
      });
      owaspOutput = await executeOwaspCli(
        scanTarget.scanPath,
        `VibeScan-${scanId}`,
        600000,
        getOwaspCommand(),
      );
    } else {
      if (!(await isDockerAvailable())) {
        if (runtimeMode === 'docker') {
          logOwaspStage(scanId, 'docker requested but unavailable');
          throw new Error('Docker is required for OWASP scanning but is not available');
        }
        logOwaspStage(scanId, 'docker unavailable, falling back to local command');
        owaspOutput = await executeOwaspCli(
          scanTarget.scanPath,
          `VibeScan-${scanId}`,
          600000,
          getOwaspCommand(),
        );
      } else {
        const dockerArgs = buildDockerArgs(scanTarget.scanPath, reportDir, dataDir, `VibeScan-${scanId}`);
        logOwaspStage(scanId, 'running docker OWASP command', {
          image: getDockerImage(),
          scanPath: scanTarget.scanPath,
          reportDir,
          dataDir,
          args: dockerArgs,
        });
        await execFilePromise('docker', dockerArgs, {
          timeout: 600000,
        });
        logOwaspStage(scanId, 'docker command finished, reading report', { reportDir });
        owaspOutput = readDependencyCheckReport(reportDir);
      }
    }

    // Normalize OWASP output to standard Finding format
    const findings = normalizeOwaspFindings(owaspOutput);
    logOwaspStage(scanId, 'findings normalized', { findings: findings.length });

    // Get OWASP version
    let owaspVersion: string | undefined;
    try {
      if (runtimeMode === 'local' || localCommandAvailable || !(await isDockerAvailable())) {
        const versionOutput = await execFilePromise(getOwaspCommand(), ['--version']);
        owaspVersion = versionOutput.stdout
          .trim()
          .match(/(\d+\.\d+\.\d+)/)?.[1];
      } else {
        const versionOutput = await execFilePromise('docker', ['run', '--rm', getDockerImage(), '--version'], {
          timeout: 20000,
        });
        owaspVersion = versionOutput.stdout
          .trim()
          .match(/(\d+\.\d+\.\d+)/)?.[1];
      }
    } catch {
      // Version detection failure is non-fatal
    }

    logOwaspStage(scanId, 'scan complete', {
      durationMs: Date.now() - startTime,
      version: owaspVersion ?? 'unknown',
      findings: findings.length,
    });

    return {
      rawOutput: findings,
      durationMs: Date.now() - startTime,
      owaspVersion,
    };
  } finally {
    if (scanTarget?.cleanup) {
      await scanTarget.cleanup();
    }
  }
}
