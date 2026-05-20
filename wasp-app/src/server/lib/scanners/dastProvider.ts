import { readFileSync, existsSync } from 'fs';
import { HttpError } from 'wasp/server';
import type { ScannerExecutionContext, ScannerProvider, ScannerScanResult } from './providerTypes.js';
import type { NormalizedComponent } from '../../services/inputAdapterService.js';
import { normalizeDastFindings } from '../../operations/scans/normalizeFindings.js';

export const dastProvider: ScannerProvider = {
  kind: 'dast',
  displayName: 'DAST Upload (OWASP ZAP)',
  supportsUserSecrets: false,

  async getHealth(): Promise<{ configured: boolean; healthy: boolean | null; message?: string }> {
    return {
      configured: true,
      healthy: true,
      message: 'DAST file parser is ready',
    };
  },

  async scanComponents(
    components: NormalizedComponent[],
    context: ScannerExecutionContext
  ): Promise<ScannerScanResult> {
    const startTime = Date.now();
    const filePath = context.inputRef;

    if (!existsSync(filePath)) {
      throw new HttpError(404, 'DAST report file not found', { detail: `File path: ${filePath}` });
    }

    try {
      const fileContent = readFileSync(filePath, 'utf8');
      const rawOutput = JSON.parse(fileContent);
      const findings = normalizeDastFindings(rawOutput);

      return {
        provider: 'dast',
        rawOutput,
        findings,
        durationMs: Date.now() - startTime,
        scannerVersion: 'N/A', // Uploaded report, version might be embedded in the report itself
      };
    } catch (error) {
      throw new HttpError(422, 'Failed to parse DAST report', {
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
