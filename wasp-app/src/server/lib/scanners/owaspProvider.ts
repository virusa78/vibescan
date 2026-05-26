/**
 * OWASP Dependency-Check Scanner Provider
 * OWASP Dependency-Check identifies known vulnerable components in dependencies
 */

import type { ScannerExecutionContext, ScannerProvider, ScannerScanResult } from './providerTypes.js';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { getOwaspCommand, isOwaspInstalled, scanWithOwaspDetailed } from './owaspScannerUtil.js';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFilePromise = promisify(execFile);

async function isDockerAvailable(): Promise<boolean> {
  try {
    await execFilePromise('docker', ['--version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export const owaspProvider: ScannerProvider = {
  kind: 'owasp',
  displayName: 'OWASP Dependency-Check',
  supportsUserSecrets: false,

  async getHealth(context?: Partial<ScannerExecutionContext>): Promise<{ configured: boolean; healthy: boolean | null; message?: string }> {
    const runtimeMode = (process.env.OWASP_RUNTIME?.trim().toLowerCase() || 'auto') as 'docker' | 'local' | 'auto';
    const dockerAvailable = await isDockerAvailable();
    const localInstalled = await isOwaspInstalled();
    const configured =
      runtimeMode === 'local'
        ? localInstalled
        : runtimeMode === 'docker'
          ? dockerAvailable
          : localInstalled || dockerAvailable;

    console.log(
      `[OWASP / Health] scan=${context?.scanId ?? 'n/a'} runtime=${runtimeMode} docker=${dockerAvailable} local=${localInstalled} configured=${configured}`,
    );

    return {
      configured,
      healthy: configured,
      message: localInstalled
        ? 'OWASP Dependency-Check is installed'
        : dockerAvailable
          ? 'OWASP Dependency-Check Docker image is ready'
          : `OWASP command not found: ${getOwaspCommand()}`,
    };
  },

  async scanComponents(
    components: NormalizedComponent[],
    context: ScannerExecutionContext
  ): Promise<ScannerScanResult> {
    console.log(
      `[OWASP / Provider] scan=${context.scanId} components=${components.length} inputType=${context.inputType} inputRef=${context.inputRef}`,
    );
    const { rawOutput, durationMs, owaspVersion } = await scanWithOwaspDetailed(components, context.scanId, {
      inputType: context.inputType,
      inputRef: context.inputRef,
      githubContext: context.githubContext,
    });

    console.log(
      `[OWASP / Provider] scan=${context.scanId} completed durationMs=${durationMs} version=${owaspVersion ?? 'unknown'} findings=${Array.isArray(rawOutput) ? rawOutput.length : 0}`,
    );

    return {
      provider: 'owasp',
      rawOutput,
      findings: rawOutput, // Already normalized by owaspScannerUtil
      durationMs,
      scannerVersion: owaspVersion,
    };
  },
};
