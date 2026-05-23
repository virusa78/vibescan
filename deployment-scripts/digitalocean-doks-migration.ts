import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import {
  getDeploymentStatePath,
  loadDeploymentState,
  saveDeploymentState,
  type DeploymentState,
} from './digitalocean-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const bootstrapScriptPath = resolve(__dirname, 'digitalocean-bootstrap.ts');

loadEnv({
  path: [resolve(repoRoot, '.env'), resolve(repoRoot, '.env.local')],
  override: false,
});

type Command = 'bootstrap' | 'update' | 'migrate' | 'status' | 'full';

type MigrationDetection = {
  localLatest?: string;
  appliedLatest?: string;
  pending: boolean;
};

function run(command: string, args: string[]): void {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function invokeBootstrapScript(args: string[]): void {
  run(process.execPath, ['--import', 'tsx', bootstrapScriptPath, ...args]);
}

function listLocalMigrations(): string[] {
  const migrationsDir = resolve(repoRoot, 'wasp-app', 'migrations');
  return readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{14}_.+/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

async function listAppliedMigrations(databaseUrl: string): Promise<string[]> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const result = await client.query<{ migration_name: string }>(
      'SELECT migration_name FROM "_prisma_migrations" ORDER BY finished_at ASC NULLS LAST, started_at ASC NULLS LAST',
    );
    return result.rows.map((row) => row.migration_name).filter((name) => Boolean(name));
  } finally {
    await client.end();
  }
}

async function detectMigration(state?: DeploymentState): Promise<MigrationDetection> {
  const localMigrations = listLocalMigrations();
  const localLatest = localMigrations.at(-1);
  if (!localLatest) {
    return { pending: false };
  }

  if (!state?.postgresUri) {
    return { localLatest, pending: true };
  }

  try {
    const applied = await listAppliedMigrations(state.postgresUri);
    const appliedSet = new Set(applied);
    const pending = localMigrations.some((migration) => !appliedSet.has(migration));
    return {
      localLatest,
      appliedLatest: applied.at(-1),
      pending,
    };
  } catch (error) {
    console.log(`Could not inspect applied migrations at ${getDeploymentStatePath()}: ${error instanceof Error ? error.message : String(error)}`);
    return {
      localLatest,
      pending: true,
    };
  }
}

function parseArgs(argv: string[]): Command {
  if (argv.includes('--bootstrap')) return 'bootstrap';
  if (argv.includes('--update')) return 'update';
  if (argv.includes('--migrate-from-droplets')) return 'migrate';
  if (argv.includes('--status')) return 'status';
  if (argv.includes('--full')) return 'full';
  return 'update';
}

function printHelp(): void {
  console.log(`Usage: node --import tsx deployment-scripts/digitalocean-doks-migration.ts [flags]

Headless entrypoint for moving a droplet deployment to DOKS and for subsequent DOKS updates.

Flags:
  --bootstrap
  --update
  --migrate-from-droplets
  --status
  --full
  --help

Default with no flags: --update
`);
}

async function runAutoFlow(label: string): Promise<void> {
  const state = loadDeploymentState();
  if (state) {
    console.log(`Using deployment state from ${getDeploymentStatePath()}`);
    console.log(`Current mode: ${state.mode}`);
  } else {
    console.log(`No saved deployment state found at ${getDeploymentStatePath()}; falling back to env defaults.`);
  }

  const migration = await detectMigration(state);
  if (migration.pending) {
    console.log(`Migration detected: local=${migration.localLatest ?? 'none'} applied=${migration.appliedLatest ?? 'none'}`);
  } else {
    console.log('No new database migration detected.');
  }

  console.log(label);
  invokeBootstrapScript(['--bootstrap']);

  if (migration.pending) {
    invokeBootstrapScript(['--migrate']);
    if (state && migration.localLatest) {
      saveDeploymentState({
        ...state,
        lastAppliedMigration: migration.localLatest,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  invokeBootstrapScript(['--build']);
  invokeBootstrapScript(['--deploy']);
  invokeBootstrapScript(['--smoke']);
  printPostDeployChecklist(state?.mode, migration);
}

async function printStatusReport(): Promise<void> {
  const state = loadDeploymentState();
  if (state) {
    console.log(`Using deployment state from ${getDeploymentStatePath()}`);
    console.log(`Current mode: ${state.mode}`);
    console.log(`Last applied migration marker: ${state.lastAppliedMigration ?? 'none'}`);
  } else {
    console.log(`No saved deployment state found at ${getDeploymentStatePath()}.`);
  }

  const migration = await detectMigration(state);
  if (migration.pending) {
    console.log(`Pending migration detected: ${migration.localLatest ?? 'unknown'}`);
  } else {
    console.log('No pending migration detected.');
  }
}

function printPostDeployChecklist(mode?: string, migration?: MigrationDetection): void {
  console.log('\nPost-deploy checklist:');
  console.log('- Verify `npm run deploy:digitalocean:migrate` completed without errors.');
  console.log('- Check the saved state at `.vibescan/digitalocean-state.json` is current.');
  if (migration?.pending) {
    console.log(`- Confirm migration ${migration.localLatest} is present in the production DB.`);
  } else {
    console.log('- Confirm no unapplied migration remains in the repo.');
  }
  if (mode === 'doks') {
    console.log('- Confirm `kubectl get pods -n vibescan` is healthy.');
    console.log('- Confirm the API and both worker deployments rolled successfully.');
    console.log('- Run the app smoke test and GitHub webhook/check-run flow once.');
  } else if (mode === 'droplet-single' || mode === 'droplet-dual') {
    console.log('- Confirm the droplets are reachable and `docker compose ps` is healthy.');
    console.log('- Confirm Cloudflare DNS still points to the expected droplet or proxy layer.');
  } else {
    console.log('- Confirm the deployment mode is correct before promoting traffic.');
  }
  console.log('- If the update touched database schema, validate the latest migration is applied.');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const command = parseArgs(argv);

  switch (command) {
    case 'bootstrap':
      invokeBootstrapScript(['--bootstrap']);
      break;
    case 'update':
      await runAutoFlow('Running DOKS update flow');
      break;
    case 'migrate': {
      const state = loadDeploymentState();
      if (state?.mode === 'droplet-single' || state?.mode === 'droplet-dual') {
        console.log(`Migrating from ${state.mode} to DOKS using ${getDeploymentStatePath()}`);
      } else {
        console.log(`No droplet deployment state detected; running DOKS bootstrap/update flow using ${getDeploymentStatePath()}`);
      }
      await runAutoFlow('Running droplet-to-DOKS migration flow');
      break;
    }
    case 'status':
      await printStatusReport();
      break;
    case 'full':
      await runAutoFlow('Running full DOKS deploy flow');
      break;
    default:
      printHelp();
      break;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
