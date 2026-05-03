import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  buildCycloneDxRolloutEvidencePack,
  buildCycloneDxRolloutMarkdown,
  collectCycloneDxRolloutWindow,
  evaluateCycloneDxStagingWindow,
  persistCycloneDxRolloutDecision,
  type CycloneDxRolloutSnapshotRecord,
  type CycloneDxRolloutWindowDecision,
} from '../wasp-app/src/server/services/cyclonedxRolloutGovernance.js';

type PrismaClient = {
  cycloneDxRolloutSnapshot: {
    findMany(args: unknown): Promise<CycloneDxRolloutSnapshotRecord[]>;
  };
  cycloneDxRolloutState: {
    upsert(args: unknown): Promise<unknown>;
  };
};

interface RolloutWindowFixture {
  snapshots: CycloneDxRolloutSnapshotRecord[];
}

function parseArgValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index < 0 || index + 1 >= process.argv.length) return undefined;
  return process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readWindowFixture(pathArg: string): RolloutWindowFixture {
  const target = resolve(pathArg);
  const parsed = JSON.parse(readFileSync(target, 'utf8')) as Partial<RolloutWindowFixture>;
  return {
    snapshots: Array.isArray(parsed.snapshots) ? (parsed.snapshots as CycloneDxRolloutSnapshotRecord[]) : [],
  };
}

function parseScannerIds(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const ids = raw
    .split(',')
    .map((scannerId) => scannerId.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

function writeEvidence(prefix: string, evidence: CycloneDxRolloutWindowDecision & { promotionReady: boolean; phaseState: {
  scannerId: string | null;
  currentStage: string;
  progressStatus: string;
  latestDecisionStatus: string;
  latestDecision: Record<string, unknown> | null;
}; }): void {
  const jsonPath = resolve(`${prefix}_EVIDENCE.json`);
  const mdPath = resolve(`${prefix}_REPORT.md`);

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, `${buildCycloneDxRolloutMarkdown(evidence)}\n`, 'utf8');
}

async function loadSnapshots(options: {
  inputFile?: string;
  windowHours: number;
  scannerIds?: string[];
  prisma: PrismaClient;
}): Promise<CycloneDxRolloutSnapshotRecord[]> {
  if (options.inputFile) {
    return readWindowFixture(options.inputFile).snapshots;
  }

  const windowStart = new Date(Date.now() - options.windowHours * 60 * 60 * 1000);
  return collectCycloneDxRolloutWindow({
    prisma: options.prisma,
    windowStart,
    scannerIds: options.scannerIds,
  });
}

async function run(): Promise<void> {
  const inputFile = parseArgValue('--input-file');
  const scannerIds = parseScannerIds(parseArgValue('--scanner-id'));
  const windowHours = Number.parseInt(parseArgValue('--window-hours') || '24', 10);
  const outputPrefix = parseArgValue('--output-prefix') || 'docs/CYCLONEDX_M4';
  const dryRun = hasFlag('--dry-run');
  const prisma = dryRun
    ? null
    : await (async () => {
        const prismaModule = await import('../wasp-app/node_modules/@prisma/client/index.js');
        return new prismaModule.PrismaClient();
      })();

  try {
    const snapshots = await loadSnapshots({
      inputFile,
      windowHours: Number.isFinite(windowHours) && windowHours > 0 ? windowHours : 24,
      scannerIds,
      prisma: prisma as PrismaClient,
    });

    const decision = evaluateCycloneDxStagingWindow({
      snapshots,
    });

    const currentSnapshot = snapshots.at(-1) || null;
    const evidence = dryRun
      ? buildCycloneDxRolloutEvidencePack({
          decision,
          scannerId: currentSnapshot?.scannerId || null,
          progressStatus: currentSnapshot?.progressStatus || 'in_progress',
          currentStage: currentSnapshot?.rolloutStage || 'shadow_smoke',
          latestDecisionStatus: currentSnapshot?.decisionStatus || decision.status,
          latestDecision: currentSnapshot ? { snapshot: currentSnapshot } : null,
        })
      : await persistCycloneDxRolloutDecision({
          prisma,
          scannerId: currentSnapshot?.scannerId || null,
          decision,
          currentStage: currentSnapshot?.rolloutStage || 'shadow_smoke',
        });

    writeEvidence(outputPrefix, evidence);

    console.log(
      JSON.stringify(
        {
          suite: decision.suite,
          status: decision.status,
          promotionReady: evidence.promotionReady,
          snapshots: decision.summary.snapshotCount,
          scanners: decision.summary.scannerIds,
        },
        null,
        2,
      ),
    );

    if (decision.status !== 'allow_promote') {
      process.exitCode = 1;
    }
  } finally {
    if (prisma) {
      await prisma.$disconnect();
    }
  }
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error('[CycloneDXM4Acceptance] failed:', message);
  process.exitCode = 1;
});
