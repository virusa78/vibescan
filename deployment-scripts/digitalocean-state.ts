import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const stateDir = resolve(repoRoot, '.vibescan');
const stateFile = resolve(stateDir, 'digitalocean-state.json');

export type DeploymentMode = 'doks' | 'droplet-single' | 'droplet-dual';

export type DeploymentState = {
  mode: DeploymentMode;
  updatedAt: string;
  lastAppliedMigration?: string;
  projectName: string;
  projectId: string;
  region: string;
  spacesRegion: string;
  vpcName: string;
  vpcId: string;
  registryName: string;
  namespace: string;
  clusterName?: string;
  clusterId?: string;
  postgresName: string;
  postgresId: string;
  postgresUri: string;
  redisName: string;
  redisId: string;
  redisUri: string;
  spacesBucket: string;
  spacesKeyName: string;
  spacesAccessKey: string;
  dropletIds?: string[];
  dropletPublicIps?: string[];
};

function ensureStateDir(): void {
  mkdirSync(stateDir, { recursive: true });
}

export function loadDeploymentState(): DeploymentState | undefined {
  try {
    const contents = readFileSync(stateFile, 'utf8');
    return JSON.parse(contents) as DeploymentState;
  } catch {
    return undefined;
  }
}

export function saveDeploymentState(state: DeploymentState): void {
  ensureStateDir();
  writeFileSync(stateFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function getDeploymentStatePath(): string {
  return stateFile;
}
