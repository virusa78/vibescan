import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  cleanupExpiredCycloneDxArtifacts,
  type CycloneDxArtifactMeta,
} from '../wasp-app/src/server/services/cyclonedxArtifactStorage.js';

interface ArtifactEntry {
  scanResultId: string;
  artifacts: CycloneDxArtifactMeta[];
}

interface ArtifactMetadataFile {
  generatedAt?: string;
  entries: ArtifactEntry[];
}

function parseArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readMetadata(pathArg: string): ArtifactMetadataFile {
  const target = resolve(pathArg);
  if (!existsSync(target)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(readFileSync(target, 'utf8')) as Partial<ArtifactMetadataFile>;
  return {
    generatedAt: parsed.generatedAt,
    entries: Array.isArray(parsed.entries) ? (parsed.entries as ArtifactEntry[]) : [],
  };
}

async function run(): Promise<void> {
  const metadataPath = parseArgValue('--metadata-file') || 'docs/CYCLONEDX_ARTIFACT_METADATA.json';
  const reportPath = parseArgValue('--report-file') || 'docs/CYCLONEDX_M3_RETENTION_REPORT.json';
  const writeBack = hasFlag('--write-back');

  const metadata = readMetadata(metadataPath);
  const reportEntries: Array<{
    scanResultId: string;
    checkedArtifacts: number;
    removedArtifacts: number;
    warnings: string[];
  }> = [];

  const nextEntries: ArtifactEntry[] = [];

  for (const entry of metadata.entries) {
    const cleanup = await cleanupExpiredCycloneDxArtifacts({ artifacts: entry.artifacts });
    reportEntries.push({
      scanResultId: entry.scanResultId,
      checkedArtifacts: entry.artifacts.length,
      removedArtifacts: cleanup.removedArtifacts.length,
      warnings: cleanup.warnings,
    });

    nextEntries.push({
      scanResultId: entry.scanResultId,
      artifacts: cleanup.keptArtifacts,
    });
  }

  if (writeBack) {
    writeFileSync(
      resolve(metadataPath),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          entries: nextEntries,
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    metadataFile: resolve(metadataPath),
    totalEntries: metadata.entries.length,
    removedArtifacts: reportEntries.reduce((acc, entry) => acc + entry.removedArtifacts, 0),
    warnings: reportEntries.flatMap((entry) => entry.warnings),
    entries: reportEntries,
  };

  writeFileSync(resolve(reportPath), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('[CycloneDXRetentionRunner] failed:', message);
  process.exitCode = 1;
});
