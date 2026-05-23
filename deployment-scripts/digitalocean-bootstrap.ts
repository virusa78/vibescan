import { config as loadEnv } from 'dotenv';
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { saveDeploymentState, type DeploymentMode } from './digitalocean-state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

loadEnv({
  path: [resolve(repoRoot, '.env'), resolve(repoRoot, '.env.local')],
  override: false,
});

type JsonRecord = Record<string, unknown>;

type Config = {
  region: string;
  spacesRegion: string;
  projectName: string;
  projectPurpose: string;
  projectEnvironment: 'Development' | 'Staging' | 'Production';
  vpcName: string;
  registryName: string;
  clusterName: string;
  clusterNodeSize: string;
  clusterNodeCount: number;
  postgresName: string;
  postgresSize: string;
  postgresNodes: number;
  redisName: string;
  redisSize: string;
  redisNodes: number;
  namespace: string;
  spacesBucket: string;
  spacesKeyName: string;
  createSpacesBucket: boolean;
  dropletSingleSize: string;
  dropletEdgeSize: string;
  dropletWorkerSize: string;
  dropletImage: string;
  dropletSshKeys: string;
};

type BootstrapState = {
  projectId: string;
  vpcId: string;
  registryName: string;
  clusterId?: string;
  dropletIds?: string[];
  dropletPublicIps?: string[];
  postgresId: string;
  postgresUri: string;
  redisId: string;
  redisUri: string;
  spacesAccessKey: string;
  spacesSecretKey: string;
};

type Command =
  | 'menu'
  | 'bootstrap'
  | 'droplet-single'
  | 'droplet-dual'
  | 'secrets'
  | 'build'
  | 'deploy'
  | 'migrate'
  | 'smoke'
  | 'status'
  | 'full'
  | 'plans';

type Invocation = {
  config: Config;
  command: Command;
};

type DropletProfile = 'single' | 'dual';

function parseArgs(argv: string[]): Invocation {
  const defaults: Config = {
    region: process.env.DO_REGION ?? 'nyc1',
    spacesRegion: process.env.DO_SPACES_REGION ?? 'nyc3',
    projectName: process.env.DO_PROJECT_NAME ?? 'vibescan-production',
    projectPurpose: process.env.DO_PROJECT_PURPOSE ?? 'Web Application',
    projectEnvironment: (process.env.DO_PROJECT_ENVIRONMENT as Config['projectEnvironment']) ?? 'Production',
    vpcName: process.env.DO_VPC_NAME ?? 'vibescan-production-vpc',
    registryName: process.env.DO_REGISTRY_NAME ?? 'vibescan',
    clusterName: process.env.DO_CLUSTER_NAME ?? 'vibescan-production',
    clusterNodeSize: process.env.DO_CLUSTER_NODE_SIZE ?? 's-4vcpu-8gb',
    clusterNodeCount: Number(process.env.DO_CLUSTER_NODE_COUNT ?? '3'),
    postgresName: process.env.DO_POSTGRES_NAME ?? 'vibescan-production-pg',
    postgresSize: process.env.DO_POSTGRES_SIZE ?? 'db-s-2vcpu-4gb',
    postgresNodes: Number(process.env.DO_POSTGRES_NODES ?? '1'),
    redisName: process.env.DO_REDIS_NAME ?? 'vibescan-production-redis',
    redisSize: process.env.DO_REDIS_SIZE ?? 'db-s-1vcpu-2gb',
    redisNodes: Number(process.env.DO_REDIS_NODES ?? '1'),
    namespace: process.env.DO_NAMESPACE ?? 'vibescan',
    spacesBucket: process.env.DO_SPACES_BUCKET ?? 'vibescan-artifacts',
    spacesKeyName: process.env.DO_SPACES_KEY_NAME ?? 'vibescan-production',
    createSpacesBucket: envFlag(process.env.DO_CREATE_SPACES_BUCKET, true),
    dropletSingleSize: process.env.DO_DROPLET_SINGLE_SIZE ?? 's-4vcpu-8gb',
    dropletEdgeSize: process.env.DO_DROPLET_EDGE_SIZE ?? 's-2vcpu-4gb',
    dropletWorkerSize: process.env.DO_DROPLET_WORKER_SIZE ?? 's-4vcpu-8gb',
    dropletImage: process.env.DO_DROPLET_IMAGE ?? 'ubuntu-24-04-x64',
    dropletSshKeys: process.env.DO_DROPLET_SSH_KEYS ?? '',
  };

  const parsed = { ...defaults };
  let command: Command | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    const takeValue = () => {
      if (!next || next.startsWith('--')) {
        throw new Error(`Missing value for ${arg}`);
      }
      i += 1;
      return next;
    };

    switch (arg) {
      case '--region':
        parsed.region = takeValue();
        break;
      case '--spaces-region':
        parsed.spacesRegion = takeValue();
        break;
      case '--project-name':
        parsed.projectName = takeValue();
        break;
      case '--project-purpose':
        parsed.projectPurpose = takeValue();
        break;
      case '--project-environment':
        parsed.projectEnvironment = normalizeProjectEnvironment(takeValue());
        break;
      case '--vpc-name':
        parsed.vpcName = takeValue();
        break;
      case '--registry-name':
        parsed.registryName = takeValue();
        break;
      case '--cluster-name':
        parsed.clusterName = takeValue();
        break;
      case '--cluster-node-size':
        parsed.clusterNodeSize = takeValue();
        break;
      case '--cluster-node-count':
        parsed.clusterNodeCount = parsePositiveInteger(takeValue(), arg);
        break;
      case '--postgres-name':
        parsed.postgresName = takeValue();
        break;
      case '--postgres-size':
        parsed.postgresSize = takeValue();
        break;
      case '--postgres-nodes':
        parsed.postgresNodes = parsePositiveInteger(takeValue(), arg);
        break;
      case '--redis-name':
        parsed.redisName = takeValue();
        break;
      case '--redis-size':
        parsed.redisSize = takeValue();
        break;
      case '--redis-nodes':
        parsed.redisNodes = parsePositiveInteger(takeValue(), arg);
        break;
      case '--namespace':
        parsed.namespace = takeValue();
        break;
      case '--spaces-bucket':
        parsed.spacesBucket = takeValue();
        break;
      case '--spaces-key-name':
        parsed.spacesKeyName = takeValue();
        break;
      case '--skip-spaces-bucket':
        parsed.createSpacesBucket = false;
        break;
      case '--create-spaces-bucket':
        parsed.createSpacesBucket = true;
        break;
      case '--droplet-single-size':
        parsed.dropletSingleSize = takeValue();
        break;
      case '--droplet-edge-size':
        parsed.dropletEdgeSize = takeValue();
        break;
      case '--droplet-worker-size':
        parsed.dropletWorkerSize = takeValue();
        break;
      case '--droplet-image':
        parsed.dropletImage = takeValue();
        break;
      case '--droplet-ssh-keys':
        parsed.dropletSshKeys = takeValue();
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      case '--menu':
        command = 'menu';
        break;
      case '--bootstrap':
        command = 'bootstrap';
        break;
      case '--droplet-single':
        command = 'droplet-single';
        break;
      case '--droplet-dual':
        command = 'droplet-dual';
        break;
      case '--secrets':
        command = 'secrets';
        break;
      case '--build':
        command = 'build';
        break;
      case '--deploy':
        command = 'deploy';
        break;
      case '--migrate':
        command = 'migrate';
        break;
      case '--smoke':
        command = 'smoke';
        break;
      case '--status':
        command = 'status';
        break;
      case '--full':
        command = 'full';
        break;
      case '--plans':
      case '--print-plans':
        command = 'plans';
        break;
      default:
        if (arg.startsWith('--')) {
          throw new Error(`Unknown flag: ${arg}`);
        }
        break;
    }
  }

  return {
    config: parsed,
    command: command ?? (argv.length > 0 ? 'bootstrap' : 'menu'),
  };
}

function printHelp(): void {
  console.log(`Usage: node --import tsx deployment-scripts/digitalocean-bootstrap.ts [flags]

Bootstraps the DigitalOcean infrastructure for VibeScan using doctl, kubectl, and the DigitalOcean API.

Defaults come from environment variables when available:
  DO_REGION, DO_SPACES_REGION, DO_PROJECT_NAME, DO_VPC_NAME, DO_REGISTRY_NAME,
  DO_CLUSTER_NAME, DO_POSTGRES_NAME, DO_REDIS_NAME, DO_NAMESPACE, DO_SPACES_BUCKET,
  DO_DROPLET_SINGLE_SIZE, DO_DROPLET_EDGE_SIZE, DO_DROPLET_WORKER_SIZE, DO_DROPLET_IMAGE, DO_DROPLET_SSH_KEYS

Flags:
  --menu
  --bootstrap
  --droplet-single
  --droplet-dual
  --secrets
  --build
  --deploy
  --migrate
  --smoke
  --status
  --full
  --plans
  --region <slug>
  --spaces-region <slug>
  --project-name <name>
  --project-purpose <purpose>
  --project-environment <Development|Staging|Production>
  --vpc-name <name>
  --registry-name <name>
  --cluster-name <name>
  --cluster-node-size <slug>
  --cluster-node-count <n>
  --postgres-name <name>
  --postgres-size <slug>
  --postgres-nodes <n>
  --redis-name <name>
  --redis-size <slug>
  --redis-nodes <n>
  --namespace <name>
  --spaces-bucket <name>
  --spaces-key-name <name>
  --skip-spaces-bucket
  --create-spaces-bucket
  --droplet-single-size <slug>
  --droplet-edge-size <slug>
  --droplet-worker-size <slug>
  --droplet-image <slug>
  --droplet-ssh-keys <comma-separated fingerprints or IDs>
`);
}

function normalizeProjectEnvironment(value: string): Config['projectEnvironment'] {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'development') return 'Development';
  if (normalized === 'staging') return 'Staging';
  if (normalized === 'production') return 'Production';
  throw new Error(`Invalid --project-environment value: ${value}`);
}

function parsePositiveInteger(value: string, flag: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }
  return parsed;
}

function envFlag(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function parseCsvList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function ensureTools(extraTools: string[] = []): void {
  const tools = ['doctl', 'kubectl', 'curl', ...extraTools];
  const missing = tools.filter((tool) => !commandExists(tool));
  if (missing.length > 0) {
    throw new Error(`Missing required tools: ${missing.join(', ')}`);
  }
}

function commandExists(command: string): boolean {
  const result = spawnSync('bash', ['-lc', `command -v ${shellEscape(command)} >/dev/null 2>&1`], {
    stdio: 'ignore',
  });
  return result.status === 0;
}

function shellEscape(value: string): string {
  return `'${value.replaceAll("'", `'\"'\"'`)}'`;
}

function run(command: string, args: string[], options?: { input?: string; allowFailure?: boolean }): string {
  console.log(`$ ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    input: options?.input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.status !== 0 && !options?.allowFailure) {
    const stderr = result.stderr?.trim();
    const stdout = result.stdout?.trim();
    throw new Error([
      `Command failed: ${command} ${args.join(' ')}`,
      stderr ? `stderr:\n${stderr}` : null,
      stdout ? `stdout:\n${stdout}` : null,
    ].filter(Boolean).join('\n'));
  }

  return (result.stdout ?? '').toString();
}

function runJson(command: string, args: string[]): unknown {
  const output = run(command, [...args, '--output', 'json']);
  const trimmed = output.trim();
  if (!trimmed) return null;
  return JSON.parse(trimmed) as unknown;
}

function runAllowFailure(command: string, args: string[], input?: string): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(command, args, {
    input,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return {
    status: result.status,
    stdout: (result.stdout ?? '').toString(),
    stderr: (result.stderr ?? '').toString(),
  };
}

function normalizeArray(value: unknown): JsonRecord[] {
  if (Array.isArray(value)) return value.filter((item): item is JsonRecord => item !== null && typeof item === 'object');
  if (value && typeof value === 'object') {
    const records = Object.values(value).flatMap((entry) => normalizeArray(entry));
    if (records.length > 0) return records;
    return [value as JsonRecord];
  }
  return [];
}

function getString(record: JsonRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

function findByName(listResult: unknown, name: string): JsonRecord | undefined {
  return normalizeArray(listResult).find((record) => {
    const recordName = getString(record, ['name', 'Name', 'slug', 'Slug']);
    return recordName === name;
  });
}

function ensureProject(cfg: Config): string {
  const existing = findByName(runJson('doctl', ['projects', 'list']), cfg.projectName);
  if (existing) {
    const id = getString(existing, ['id', 'ID']);
    if (!id) throw new Error(`Found project ${cfg.projectName}, but could not read its ID`);
    console.log(`Reusing project ${cfg.projectName} (${id})`);
    return id;
  }

  const created = runJson('doctl', [
    'projects',
    'create',
    '--name',
    cfg.projectName,
    '--purpose',
    cfg.projectPurpose,
    '--environment',
    cfg.projectEnvironment,
  ]);
  const record = findByName(created, cfg.projectName) ?? normalizeArray(created)[0];
  const id = getString(record ?? {}, ['id', 'ID']);
  if (!id) throw new Error(`Unable to determine project ID for ${cfg.projectName}`);
  console.log(`Created project ${cfg.projectName} (${id})`);
  return id;
}

function ensureVpc(cfg: Config): string {
  const existing = findByName(runJson('doctl', ['vpcs', 'list']), cfg.vpcName);
  if (existing) {
    const id = getString(existing, ['id', 'ID', 'uuid', 'UUID']);
    if (!id) throw new Error(`Found VPC ${cfg.vpcName}, but could not read its ID`);
    console.log(`Reusing VPC ${cfg.vpcName} (${id})`);
    return id;
  }

  const created = runJson('doctl', ['vpcs', 'create', '--name', cfg.vpcName, '--region', cfg.region]);
  const record = findByName(created, cfg.vpcName) ?? normalizeArray(created)[0];
  const id = getString(record ?? {}, ['id', 'ID', 'uuid', 'UUID']);
  if (!id) throw new Error(`Unable to determine VPC UUID for ${cfg.vpcName}`);
  console.log(`Created VPC ${cfg.vpcName} (${id})`);
  return id;
}

function ensureRegistry(cfg: Config): void {
  const existing = findByName(runJson('doctl', ['registries', 'list']), cfg.registryName);
  if (existing) {
    console.log(`Reusing registry ${cfg.registryName}`);
    return;
  }

  const created = runAllowFailure('doctl', ['registry', 'create', cfg.registryName, '--region', cfg.region]);
  if (created.status !== 0) {
    const lower = `${created.stderr}\n${created.stdout}`.toLowerCase();
    if (!lower.includes('already exists')) {
      throw new Error(`Failed to create registry ${cfg.registryName}\n${created.stderr || created.stdout}`);
    }
    console.log(`Registry ${cfg.registryName} already exists`);
  } else {
    console.log(`Created registry ${cfg.registryName}`);
  }
}

function ensureCluster(cfg: Config, vpcId: string): string {
  const existing = findByName(runJson('doctl', ['kubernetes', 'cluster', 'list']), cfg.clusterName);
  if (existing) {
    const id = getString(existing, ['id', 'ID', 'uuid', 'UUID']);
    if (!id) throw new Error(`Found cluster ${cfg.clusterName}, but could not read its ID`);
    console.log(`Reusing cluster ${cfg.clusterName} (${id})`);
    return id;
  }

  const created = runJson('doctl', [
    'kubernetes',
    'cluster',
    'create',
    cfg.clusterName,
    '--region',
    cfg.region,
    '--vpc-uuid',
    vpcId,
    '--version',
    'latest',
    '--node-pool',
    `name=apps;size=${cfg.clusterNodeSize};count=${String(cfg.clusterNodeCount)}`,
    '--wait',
  ]);

  const record = findByName(created, cfg.clusterName) ?? normalizeArray(created)[0];
  const id = getString(record ?? {}, ['id', 'ID', 'uuid', 'UUID']);
  if (!id) throw new Error(`Unable to determine cluster ID for ${cfg.clusterName}`);
  console.log(`Created cluster ${cfg.clusterName} (${id})`);
  return id;
}

function ensureDatabase(cfg: Config, kind: 'pg' | 'redis', name: string, size: string, nodes: number, vpcId: string): { id: string; uri: string } {
  const existing = findByName(runJson('doctl', ['databases', 'list']), name);
  let dbId: string | undefined;

  if (existing) {
    dbId = getString(existing, ['id', 'ID']);
    if (!dbId) throw new Error(`Found database ${name}, but could not read its ID`);
    console.log(`Reusing ${kind} cluster ${name} (${dbId})`);
  } else {
    const created = runJson('doctl', [
      'databases',
      'create',
      name,
      '--engine',
      kind,
      '--region',
      cfg.region,
      '--size',
      size,
      '--num-nodes',
      String(nodes),
      '--private-network-uuid',
      vpcId,
      '--wait',
    ]);
    const record = findByName(created, name) ?? normalizeArray(created)[0];
    dbId = getString(record ?? {}, ['id', 'ID']);
    if (!dbId) throw new Error(`Unable to determine database ID for ${name}`);
    console.log(`Created ${kind} cluster ${name} (${dbId})`);
  }

  const connection = run('doctl', ['databases', 'connection', dbId, '--private', '--format', 'URI', '--no-header']).trim();
  if (!connection) {
    throw new Error(`Unable to read private connection URI for database ${name}`);
  }
  return { id: dbId, uri: connection };
}

function waitForDroplet(id: string, label: string, timeoutMs = 20 * 60 * 1000): { id: string; publicIp: string } {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const response = runJsonApi(`/v2/droplets/${id}`);
    const droplet = response && typeof response === 'object' ? ((response as JsonRecord).droplet as JsonRecord | undefined) : undefined;
    const status = getString(droplet ?? {}, ['status', 'Status'])?.toLowerCase();
    const networks = droplet?.networks && typeof droplet.networks === 'object' ? droplet.networks as JsonRecord : undefined;
    const ipv4 = networks ? normalizeArray(networks).flatMap((record) => {
      const address = getString(record, ['ip_address', 'IPAddress']);
      const type = getString(record, ['type', 'Type'])?.toLowerCase();
      return type === 'public' && address ? [address] : [];
    }) : [];

    if (status === 'active' && ipv4[0]) {
      console.log(`Droplet ${label} is active at ${ipv4[0]}`);
      return { id, publicIp: ipv4[0] };
    }

    console.log(`Waiting for droplet ${label} (${id}) to become active...`);
    run('sleep', ['20']);
  }

  throw new Error(`Timed out waiting for droplet ${label} (${id})`);
}

function ensureFirewall(name: string, tagName: string, allowHttp = false): void {
  const existing = findByName(runJsonApi('/v2/firewalls'), name);
  if (existing) {
    console.log(`Reusing firewall ${name}`);
    return;
  }

  const inboundRules = [
    {
      protocol: 'tcp',
      ports: '22',
      sources: {
        addresses: ['0.0.0.0/0', '::/0'],
      },
    },
  ];

  if (allowHttp) {
    inboundRules.push(
      {
        protocol: 'tcp',
        ports: '80',
        sources: { addresses: ['0.0.0.0/0', '::/0'] },
      },
      {
        protocol: 'tcp',
        ports: '443',
        sources: { addresses: ['0.0.0.0/0', '::/0'] },
      },
    );
  }

  runJsonApi('/v2/firewalls', 'POST', JSON.stringify({
    name,
    droplet_ids: [],
    tags: [tagName],
    inbound_rules: inboundRules,
    outbound_rules: [
      { protocol: 'tcp', ports: 'all', destinations: { addresses: ['0.0.0.0/0', '::/0'] } },
      { protocol: 'udp', ports: 'all', destinations: { addresses: ['0.0.0.0/0', '::/0'] } },
      { protocol: 'icmp', destinations: { addresses: ['0.0.0.0/0', '::/0'] } },
    ],
  }));
  console.log(`Created firewall ${name}`);
}

function ensureDroplet(
  cfg: Config,
  name: string,
  size: string,
  sshKeys: string[],
  vpcId: string,
  userData: string,
  tags: string[],
): { id: string; publicIp: string } {
  const existing = findByName(runJsonApi('/v2/droplets'), name);
  if (existing) {
    const id = getString(existing, ['id', 'ID']);
    if (!id) throw new Error(`Found droplet ${name}, but could not read its ID`);
    const currentStatus = getString(existing, ['status', 'Status'])?.toLowerCase();
    if (currentStatus === 'active') {
      const publicIp = extractDropletPublicIp(existing);
      if (publicIp) {
        console.log(`Reusing droplet ${name} (${id}) at ${publicIp}`);
        return { id, publicIp };
      }
    }
    return waitForDroplet(id, name);
  }

  const payload: JsonRecord = {
    name,
    region: cfg.region,
    size,
    image: cfg.dropletImage,
    vpc_uuid: vpcId,
    user_data: userData,
    tags,
    monitoring: true,
    ipv6: true,
  };

  if (sshKeys.length > 0) {
    payload.ssh_keys = sshKeys;
  }

  const response = runJsonApi('/v2/droplets', 'POST', JSON.stringify(payload));
  const droplet = response && typeof response === 'object' ? ((response as JsonRecord).droplet as JsonRecord | undefined) : undefined;
  const id = getString(droplet ?? {}, ['id', 'ID']);
  if (!id) {
    throw new Error(`Unable to determine droplet ID for ${name}`);
  }
  return waitForDroplet(id, name);
}

function extractDropletPublicIp(record: JsonRecord): string | undefined {
  const networks = record.networks && typeof record.networks === 'object' ? record.networks as JsonRecord : undefined;
  if (!networks) return undefined;
  for (const network of normalizeArray(networks)) {
    const type = getString(network, ['type', 'Type'])?.toLowerCase();
    const address = getString(network, ['ip_address', 'IPAddress']);
    if (type === 'public' && address) {
      return address;
    }
  }
  return undefined;
}

function ensureSpacesKey(cfg: Config): { accessKey: string; secretKey: string } {
  const existing = findByName(runJsonApi('/v2/spaces/keys'), cfg.spacesKeyName);
  if (existing) {
    const accessKey = getString(existing, ['access_key', 'accessKey']);
    if (!accessKey) throw new Error(`Found Spaces key ${cfg.spacesKeyName}, but could not read its access key`);
    console.log(`Reusing Spaces key ${cfg.spacesKeyName} (${accessKey})`);
    // We cannot recover the secret from the API. Keep going and let the user rotate or inspect manually if needed.
    return { accessKey, secretKey: '' };
  }

  const payload = {
    name: cfg.spacesKeyName,
    grants: [
      {
        bucket: cfg.spacesBucket,
        permission: 'readwrite',
      },
    ],
  };

  const response = runJsonApi('/v2/spaces/keys', 'POST', JSON.stringify(payload));
  const key = response && typeof response === 'object' ? (response as JsonRecord).key as JsonRecord | undefined : undefined;
  const accessKey = getString(key ?? {}, ['access_key', 'accessKey']);
  const secretKey = getString(key ?? {}, ['secret_key', 'secretKey']);
  if (!accessKey || !secretKey) {
    throw new Error(`Unable to create Spaces key ${cfg.spacesKeyName}`);
  }
  console.log(`Created Spaces key ${cfg.spacesKeyName} (${accessKey})`);
  return { accessKey, secretKey };
}

function runJsonApi(path: string, method = 'GET', body?: string): unknown {
  const token = process.env.DO_TOKEN?.trim()
    || process.env.PAT?.trim()
    || process.env.DIGITALOCEAN_TOKEN?.trim();
  if (!token) {
    throw new Error('Set DO_TOKEN, PAT, or DIGITALOCEAN_TOKEN in .env to call the DigitalOcean API for Spaces keys');
  }

  const args = ['-sS', '--fail-with-body', '-X', method, '-H', 'Authorization: Bearer ' + token];
  if (body) {
    args.push('-H', 'Content-Type: application/json', '-d', body);
  }
  args.push(`https://api.digitalocean.com${path}`);
  const result = run('curl', args);
  return result.trim() ? JSON.parse(result) as unknown : null;
}

function ensureSpacesBucket(cfg: Config, accessKey: string, secretKey: string): void {
  if (!cfg.createSpacesBucket) {
    console.log(`Skipping Spaces bucket creation for ${cfg.spacesBucket}`);
    return;
  }

  if (!secretKey) {
    console.log(`Spaces bucket creation skipped because the Spaces secret key is unavailable for ${cfg.spacesKeyName}.`);
    return;
  }

  if (!commandExists('aws')) {
    console.log('aws CLI not found; skipping bucket creation. Create the bucket manually in Spaces or install aws-cli and rerun.');
    return;
  }

  const endpoint = `https://${cfg.spacesRegion}.digitaloceanspaces.com`;
  const env = {
    ...process.env,
    AWS_ACCESS_KEY_ID: accessKey,
    AWS_SECRET_ACCESS_KEY: secretKey,
    AWS_DEFAULT_REGION: 'us-east-1',
  };

  const result = spawnSync('aws', ['s3api', 'create-bucket', '--bucket', cfg.spacesBucket, '--endpoint-url', endpoint], {
    encoding: 'utf8',
    env,
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? '';
    const stdout = result.stdout?.trim() ?? '';
    const output = `${stderr}\n${stdout}`.toLowerCase();
    if (output.includes('bucket already owned by you') || output.includes('already exists')) {
      console.log(`Spaces bucket ${cfg.spacesBucket} already exists`);
      return;
    }

    console.log(`Could not auto-create Spaces bucket ${cfg.spacesBucket}. You may need to create it manually in the control panel.`);
    if (stderr) console.log(stderr);
    if (stdout) console.log(stdout);
    return;
  }

  console.log(`Created Spaces bucket ${cfg.spacesBucket} in ${cfg.spacesRegion}`);
}

function ensureNamespace(namespace: string): void {
  const manifest = [
    'apiVersion: v1',
    'kind: Namespace',
    'metadata:',
    `  name: ${namespace}`,
    '  labels:',
    `    name: ${namespace}`,
    '    managed-by: digitalocean-bootstrap',
    '',
  ].join('\n');
  run('kubectl', ['apply', '-f', '-'], { input: manifest });
}

function ensureRegistrySecret(cfg: Config): void {
  const manifest = run('doctl', ['registry', 'kubernetes-manifest', cfg.registryName, '--namespace', cfg.namespace]);
  run('kubectl', ['apply', '-f', '-'], { input: manifest });
}

function generateJwtSecret(length = 32): string {
  return randomBytes(length).toString('hex');
}

function formatYamlScalar(value: string): string {
  if (value.includes('\n')) {
    return `|-\n${value.split('\n').map((line) => `    ${line}`).join('\n')}`;
  }

  return JSON.stringify(value);
}

function buildConfigMapManifest(cfg: Config): string {
  const lines = [
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    '  name: vibescan-config',
    `  namespace: ${cfg.namespace}`,
    'data:',
    `  NODE_ENV: ${formatYamlScalar('production')}`,
    `  PORT: ${formatYamlScalar('3000')}`,
    `  LOG_LEVEL: ${formatYamlScalar('info')}`,
    `  VIBESCAN_EMBED_WORKERS: ${formatYamlScalar('false')}`,
    `  AWS_S3_REGION: ${formatYamlScalar(cfg.spacesRegion)}`,
    `  AWS_S3_ENDPOINT: ${formatYamlScalar(`https://${cfg.spacesRegion}.digitaloceanspaces.com`)}`,
    `  AWS_S3_FILES_BUCKET: ${formatYamlScalar(cfg.spacesBucket)}`,
    `  AWS_S3_FORCE_PATH_STYLE: ${formatYamlScalar('true')}`,
  ];
  return `${lines.join('\n')}\n`;
}

function readRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function buildSecretManifest(cfg: Config, state: BootstrapState): string {
  const optionalEntries: Array<[string, string | undefined]> = [
    ['GITHUB_APP_API_BASE_URL', process.env.GITHUB_APP_API_BASE_URL?.trim()],
    ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY?.trim()],
    ['STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET?.trim()],
    ['VIBESCAN_ENABLE_SNYK_SCANNER', process.env.VIBESCAN_ENABLE_SNYK_SCANNER?.trim()],
    ['VIBESCAN_SNYK_CREDENTIAL_MODE', process.env.VIBESCAN_SNYK_CREDENTIAL_MODE?.trim()],
    ['SNYK_TOKEN', process.env.SNYK_TOKEN?.trim()],
    ['SNYK_ORG_ID', process.env.SNYK_ORG_ID?.trim()],
    ['SNYK_RUNTIME', process.env.SNYK_RUNTIME?.trim()],
    ['SNYK_COMMAND', process.env.SNYK_COMMAND?.trim()],
    ['SNYK_SSH_HOST', process.env.SNYK_SSH_HOST?.trim()],
    ['SNYK_SSH_USER', process.env.SNYK_SSH_USER?.trim()],
    ['SNYK_SSH_PORT', process.env.SNYK_SSH_PORT?.trim()],
    ['SNYK_SSH_IDENTITY_FILE', process.env.SNYK_SSH_IDENTITY_FILE?.trim()],
    ['SNYK_SSH_REMOTE_TMP_DIR', process.env.SNYK_SSH_REMOTE_TMP_DIR?.trim()],
  ];

  const data: Array<[string, string]> = [
    ['DATABASE_URL', state.postgresUri],
    ['REDIS_URL', state.redisUri],
    ['JWT_SECRET', readRequiredEnv('JWT_SECRET')],
    ['ENCRYPTION_KEY', readRequiredEnv('ENCRYPTION_KEY')],
    ['GITHUB_APP_ID', readRequiredEnv('GITHUB_APP_ID')],
    ['GITHUB_APP_SLUG', readRequiredEnv('GITHUB_APP_SLUG')],
    ['GITHUB_APP_PRIVATE_KEY', readRequiredEnv('GITHUB_APP_PRIVATE_KEY')],
    ['GITHUB_APP_WEBHOOK_SECRET', readRequiredEnv('GITHUB_APP_WEBHOOK_SECRET')],
    ['AWS_S3_IAM_ACCESS_KEY', state.spacesAccessKey],
    ['AWS_S3_IAM_SECRET_KEY', state.spacesSecretKey || readRequiredEnv('AWS_S3_IAM_SECRET_KEY')],
  ];

  for (const [key, value] of optionalEntries) {
    if (value) {
      data.push([key, value]);
    }
  }

  const lines = [
    'apiVersion: v1',
    'kind: Secret',
    'metadata:',
    '  name: vibescan-secrets',
    `  namespace: ${cfg.namespace}`,
    'type: Opaque',
    'stringData:',
    ...data.map(([key, value]) => `  ${key}: ${formatYamlScalar(value)}`),
  ];

  return `${lines.join('\n')}\n`;
}

function applyManifest(manifest: string): void {
  run('kubectl', ['apply', '-f', '-'], { input: manifest });
}

function serializeEnvFileValue(value: string): string {
  return value.replaceAll('\n', '\\n');
}

function buildRuntimeEnvLines(cfg: Config, state: BootstrapState): string[] {
  const optionalEntries: Array<[string, string | undefined]> = [
    ['GITHUB_APP_API_BASE_URL', process.env.GITHUB_APP_API_BASE_URL?.trim()],
    ['STRIPE_SECRET_KEY', process.env.STRIPE_SECRET_KEY?.trim()],
    ['STRIPE_WEBHOOK_SECRET', process.env.STRIPE_WEBHOOK_SECRET?.trim()],
    ['VIBESCAN_ENABLE_SNYK_SCANNER', process.env.VIBESCAN_ENABLE_SNYK_SCANNER?.trim()],
    ['VIBESCAN_SNYK_CREDENTIAL_MODE', process.env.VIBESCAN_SNYK_CREDENTIAL_MODE?.trim()],
    ['SNYK_TOKEN', process.env.SNYK_TOKEN?.trim()],
    ['SNYK_ORG_ID', process.env.SNYK_ORG_ID?.trim()],
    ['SNYK_RUNTIME', process.env.SNYK_RUNTIME?.trim()],
    ['SNYK_COMMAND', process.env.SNYK_COMMAND?.trim()],
    ['SNYK_SSH_HOST', process.env.SNYK_SSH_HOST?.trim()],
    ['SNYK_SSH_USER', process.env.SNYK_SSH_USER?.trim()],
    ['SNYK_SSH_PORT', process.env.SNYK_SSH_PORT?.trim()],
    ['SNYK_SSH_IDENTITY_FILE', process.env.SNYK_SSH_IDENTITY_FILE?.trim()],
    ['SNYK_SSH_REMOTE_TMP_DIR', process.env.SNYK_SSH_REMOTE_TMP_DIR?.trim()],
  ];

  const entries: Array<[string, string]> = [
    ['NODE_ENV', 'production'],
    ['PORT', '3000'],
    ['LOG_LEVEL', 'info'],
    ['VIBESCAN_EMBED_WORKERS', 'false'],
    ['DATABASE_URL', state.postgresUri],
    ['REDIS_URL', state.redisUri],
    ['JWT_SECRET', readRequiredEnv('JWT_SECRET')],
    ['ENCRYPTION_KEY', readRequiredEnv('ENCRYPTION_KEY')],
    ['GITHUB_APP_ID', readRequiredEnv('GITHUB_APP_ID')],
    ['GITHUB_APP_SLUG', readRequiredEnv('GITHUB_APP_SLUG')],
    ['GITHUB_APP_PRIVATE_KEY', readRequiredEnv('GITHUB_APP_PRIVATE_KEY')],
    ['GITHUB_APP_WEBHOOK_SECRET', readRequiredEnv('GITHUB_APP_WEBHOOK_SECRET')],
    ['AWS_S3_IAM_ACCESS_KEY', state.spacesAccessKey],
    ['AWS_S3_IAM_SECRET_KEY', state.spacesSecretKey || readRequiredEnv('AWS_S3_IAM_SECRET_KEY')],
    ['AWS_S3_REGION', cfg.spacesRegion],
    ['AWS_S3_ENDPOINT', `https://${cfg.spacesRegion}.digitaloceanspaces.com`],
    ['AWS_S3_FILES_BUCKET', cfg.spacesBucket],
    ['AWS_S3_FORCE_PATH_STYLE', 'true'],
  ];

  for (const [key, value] of optionalEntries) {
    if (value) {
      entries.push([key, value]);
    }
  }

  return entries.map(([key, value]) => `${key}=${serializeEnvFileValue(value)}`);
}

function buildCloudInitScript(
  cfg: Config,
  state: BootstrapState,
  dropletRole: DropletProfile | 'edge' | 'workers',
  tag: string,
  apiImage: string,
  workerImage: string,
): string {
  const envLines = buildRuntimeEnvLines(cfg, state)
    .concat([
      `DO_REGISTRY_NAME=${serializeEnvFileValue(cfg.registryName)}`,
      `DO_REGISTRY_IMAGE=${serializeEnvFileValue(`registry.digitalocean.com/${cfg.registryName}`)}`,
      `VIBESCAN_IMAGE_TAG=${serializeEnvFileValue(tag)}`,
      `VIBESCAN_API_IMAGE=${serializeEnvFileValue(apiImage)}`,
      `VIBESCAN_WORKER_IMAGE=${serializeEnvFileValue(workerImage)}`,
      `VIBESCAN_DEPLOY_PROFILE=${serializeEnvFileValue(dropletRole)}`,
      `VIBESCAN_PRIMARY_DOMAIN=${serializeEnvFileValue(process.env.DO_DOMAIN?.trim() || 'vibescan.pro')}`,
      `VIBESCAN_API_DOMAIN=${serializeEnvFileValue(process.env.DO_GITHUB_WEBHOOK_DOMAIN?.trim() || `api.${process.env.DO_DOMAIN?.trim() || 'vibescan.pro'}`)}`,
    ])
    .join('\n');
  const bootstrapToken = process.env.DO_TOKEN?.trim() || process.env.PAT?.trim() || process.env.DIGITALOCEAN_TOKEN?.trim() || '';

  const domain = process.env.DO_DOMAIN?.trim() || 'vibescan.pro';
  const apiDomain = process.env.DO_GITHUB_WEBHOOK_DOMAIN?.trim() || `api.${domain}`;
  const caddyfile = [
    `${domain} {`,
    '  reverse_proxy api:3000',
    '}',
    '',
    `${apiDomain} {`,
    '  reverse_proxy api:3000',
    '}',
  ].join('\n');

  const composeContents = dropletRole === 'workers'
    ? [
        'services:',
        '  free-worker:',
        `    image: ${workerImage}`,
        '    env_file:',
        '      - .env',
        '    environment:',
        '      WORKER_ROLE: free',
        '    restart: unless-stopped',
        '  enterprise-worker:',
        `    image: ${workerImage}`,
        '    env_file:',
        '      - .env',
        '    environment:',
        '      WORKER_ROLE: enterprise',
        '    restart: unless-stopped',
      ].join('\n')
    : dropletRole === 'edge'
      ? [
          'services:',
          '  api:',
          `    image: ${apiImage}`,
          '    env_file:',
          '      - .env',
          '    restart: unless-stopped',
          '    expose:',
          '      - "3000"',
          '  caddy:',
          '    image: caddy:2-alpine',
          '    restart: unless-stopped',
          '    ports:',
          '      - "80:80"',
          '      - "443:443"',
          '    volumes:',
          '      - ./Caddyfile:/etc/caddy/Caddyfile:ro',
        ].join('\n')
      : [
          'services:',
          '  api:',
          `    image: ${apiImage}`,
          '    env_file:',
          '      - .env',
          '    restart: unless-stopped',
          '    expose:',
          '      - "3000"',
          '  free-worker:',
          `    image: ${workerImage}`,
          '    env_file:',
          '      - .env',
          '    environment:',
          '      WORKER_ROLE: free',
          '    restart: unless-stopped',
          '  enterprise-worker:',
          `    image: ${workerImage}`,
          '    env_file:',
          '      - .env',
          '    environment:',
          '      WORKER_ROLE: enterprise',
          '    restart: unless-stopped',
          '  caddy:',
          '    image: caddy:2-alpine',
          '    restart: unless-stopped',
          '    ports:',
          '      - "80:80"',
          '      - "443:443"',
          '    volumes:',
          '      - ./Caddyfile:/etc/caddy/Caddyfile:ro',
        ].join('\n');

  return [
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update',
    'apt-get install -y ca-certificates curl jq gnupg lsb-release',
    'install -m 0755 -d /etc/apt/keyrings',
    'curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg',
    'chmod a+r /etc/apt/keyrings/docker.gpg',
    'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list',
    'apt-get update',
    'apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin',
    'systemctl enable --now docker',
    `DO_TOKEN=${shellEscape(bootstrapToken)}`,
    'docker login registry.digitalocean.com -u doctl -p "$DO_TOKEN"',
    'mkdir -p /opt/vibescan',
    `cat >/opt/vibescan/.env <<'EOF'`,
    envLines,
    'EOF',
    `cat >/opt/vibescan/docker-compose.yml <<'EOF'`,
    composeContents,
    'EOF',
    `cat >/opt/vibescan/Caddyfile <<'EOF'`,
    caddyfile,
    'EOF',
    'cd /opt/vibescan',
    'docker compose pull',
    'docker compose up -d',
    'echo "VibeScan droplet bootstrap complete" >/etc/motd',
  ].join('\n');
}

function createReadline() {
  return createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

async function prompt(rl: ReturnType<typeof createReadline>, message: string, defaultValue = ''): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = await rl.question(`${message}${suffix}: `);
  const trimmed = answer.trim();
  return trimmed || defaultValue;
}

async function promptConfirm(rl: ReturnType<typeof createReadline>, message: string, defaultValue = false): Promise<boolean> {
  const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
  const answer = (await rl.question(`${message}${suffix}: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ['y', 'yes', 'true', '1'].includes(answer);
}

function currentGitSha(): string {
  return run('git', ['rev-parse', '--short', 'HEAD']).trim();
}

function registryImage(registryName: string, imageName: string, tag: string): string {
  return `registry.digitalocean.com/${registryName}/${imageName}:${tag}`;
}

function buildAndPushImages(cfg: Config, tag = currentGitSha()): { apiImage: string; workerImage: string } {
  ensureTools(['docker', 'git']);
  run('doctl', ['registry', 'login']);
  const apiImage = registryImage(cfg.registryName, 'vibescan-api', tag);
  const workerImage = registryImage(cfg.registryName, 'vibescan-worker', tag);
  run('docker', ['build', '-t', apiImage, '-f', 'Dockerfile', '.']);
  run('docker', ['build', '-t', workerImage, '-f', 'Dockerfile.worker', '.']);
  run('docker', ['push', apiImage]);
  run('docker', ['push', workerImage]);
  return { apiImage, workerImage };
}

function applyRuntimeConfigAndSecrets(cfg: Config, state: BootstrapState): void {
  applyManifest(buildConfigMapManifest(cfg));
  applyManifest(buildSecretManifest(cfg, state));
}

function rolloutImages(cfg: Config, tag = currentGitSha()): void {
  const apiImage = registryImage(cfg.registryName, 'vibescan-api', tag);
  const workerImage = registryImage(cfg.registryName, 'vibescan-worker', tag);
  run('kubectl', ['set', 'image', 'deployment/vibescan-api', `api=${apiImage}`, '-n', cfg.namespace]);
  run('kubectl', ['set', 'image', 'deployment/vibescan-free-worker', `worker=${workerImage}`, '-n', cfg.namespace]);
  run('kubectl', ['set', 'image', 'deployment/vibescan-enterprise-worker', `worker=${workerImage}`, '-n', cfg.namespace]);
  run('kubectl', ['rollout', 'status', 'deployment/vibescan-api', '-n', cfg.namespace, '--timeout=10m']);
  run('kubectl', ['rollout', 'status', 'deployment/vibescan-free-worker', '-n', cfg.namespace, '--timeout=10m']);
  run('kubectl', ['rollout', 'status', 'deployment/vibescan-enterprise-worker', '-n', cfg.namespace, '--timeout=10m']);
}

function runMigration(cfg: Config, state: BootstrapState, migrationName: string): void {
  run('bash', [
    '-lc',
    `cd ${shellEscape('wasp-app')} && DATABASE_URL=${shellEscape(state.postgresUri)} wasp db migrate-dev --name ${shellEscape(migrationName)}`,
  ]);
}

function smokeTest(_cfg: Config): void {
  const healthUrl = process.env.DO_HEALTH_URL?.trim() || `https://${process.env.DO_DOMAIN?.trim() || 'vibescan.pro'}/health`;
  const loginUrl = process.env.DO_LOGIN_URL?.trim() || `https://${process.env.DO_DOMAIN?.trim() || 'vibescan.pro'}/login`;
  run('curl', ['-f', healthUrl]);
  run('curl', ['-f', loginUrl]);
}

function showStatus(cfg: Config): void {
  run('kubectl', ['get', 'pods', '-n', cfg.namespace, '-o', 'wide'], { allowFailure: true });
  run('kubectl', ['get', 'deploy', '-n', cfg.namespace], { allowFailure: true });
  run('kubectl', ['get', 'svc', '-n', cfg.namespace], { allowFailure: true });
  run('kubectl', ['get', 'ingress', '-n', cfg.namespace], { allowFailure: true });
  run('doctl', ['compute', 'droplet', 'list']);
  run('doctl', ['compute', 'firewall', 'list']);
  run('doctl', ['kubernetes', 'cluster', 'list']);
  run('doctl', ['databases', 'list']);
}

function printArchitecturePlans(): void {
  console.log(`
Minimal one-droplet:
  Cloudflare -> Droplet A (Nginx/Caddy + API + workers) -> Managed PostgreSQL/Redis -> Spaces

Practical two-droplet:
  Cloudflare -> Droplet A (edge + API) and Droplet B (workers) -> Managed PostgreSQL/Redis -> Spaces

Production-safe DOKS:
  Cloudflare -> Ingress/LB -> DOKS API + workers -> Managed PostgreSQL/Redis -> Spaces

Migration path:
  Droplet stack -> DOKS bootstrap/update wrapper -> rolling DOKS updates with the same images
`);
}

function deployAll(cfg: Config): void {
  const state = bootstrapInfrastructure(cfg, 'doks');
  applyRuntimeConfigAndSecrets(cfg, state);
  buildAndPushImages(cfg);
  runMigration(cfg, state, `deploy-${new Date().toISOString().slice(0, 10)}`);
  rolloutImages(cfg);
  smokeTest(cfg);
}

function bootstrapInfrastructure(cfg: Config, mode: 'doks' | 'droplet-single' | 'droplet-dual' = 'doks'): BootstrapState {
  ensureTools();

  const state: Partial<BootstrapState> = {};
  state.projectId = ensureProject(cfg);
  state.vpcId = ensureVpc(cfg);
  ensureRegistry(cfg);
  const postgres = ensureDatabase(cfg, 'pg', cfg.postgresName, cfg.postgresSize, cfg.postgresNodes, state.vpcId);
  state.postgresId = postgres.id;
  state.postgresUri = postgres.uri;
  const redis = ensureDatabase(cfg, 'redis', cfg.redisName, cfg.redisSize, cfg.redisNodes, state.vpcId);
  state.redisId = redis.id;
  state.redisUri = redis.uri;

  const spaces = ensureSpacesKey(cfg);
  state.spacesAccessKey = spaces.accessKey;
  state.spacesSecretKey = spaces.secretKey;
  ensureSpacesBucket(cfg, spaces.accessKey, spaces.secretKey);

  if (mode === 'doks') {
    state.clusterId = ensureCluster(cfg, state.vpcId);
    ensureNamespace(cfg.namespace);
    ensureRegistrySecret(cfg);
    console.log(`JWT_SECRET=${generateJwtSecret()}`);
  } else {
    const tag = currentGitSha();
    buildAndPushImages(cfg, tag);
    const apiImage = registryImage(cfg.registryName, 'vibescan-api', tag);
    const workerImage = registryImage(cfg.registryName, 'vibescan-worker', tag);
    const sshKeys = parseCsvList(cfg.dropletSshKeys);
    const singleName = `${cfg.projectName}-single`;
    const edgeName = `${cfg.projectName}-edge`;
    const workersName = `${cfg.projectName}-workers`;

    const dropletIds: string[] = [];
    const dropletIps: string[] = [];
    const primaryTags = ['vibescan', mode];

    if (mode === 'droplet-single') {
      const bootstrap = buildCloudInitScript(cfg, state as BootstrapState, 'single', tag, apiImage, workerImage);
      const droplet = ensureDroplet(
        cfg,
        singleName,
        cfg.dropletSingleSize,
        sshKeys,
        state.vpcId,
        bootstrap,
        primaryTags,
      );
      dropletIds.push(droplet.id);
      dropletIps.push(droplet.publicIp);
      ensureFirewall(`${cfg.projectName}-single-fw`, 'vibescan', true);
    } else {
      const edgeBootstrap = buildCloudInitScript(cfg, state as BootstrapState, 'edge', tag, apiImage, workerImage);
      const workerBootstrap = buildCloudInitScript(cfg, state as BootstrapState, 'workers', tag, apiImage, workerImage);
      const edgeDroplet = ensureDroplet(
        cfg,
        edgeName,
        cfg.dropletEdgeSize,
        sshKeys,
        state.vpcId,
        edgeBootstrap,
        ['vibescan', 'vibescan-edge'],
      );
      const workerDroplet = ensureDroplet(
        cfg,
        workersName,
        cfg.dropletWorkerSize,
        sshKeys,
        state.vpcId,
        workerBootstrap,
        ['vibescan', 'vibescan-workers'],
      );
      dropletIds.push(edgeDroplet.id, workerDroplet.id);
      dropletIps.push(edgeDroplet.publicIp, workerDroplet.publicIp);
      ensureFirewall(`${cfg.projectName}-edge-fw`, 'vibescan-edge', true);
      ensureFirewall(`${cfg.projectName}-workers-fw`, 'vibescan-workers', false);
    }

    state.dropletIds = dropletIds;
    state.dropletPublicIps = dropletIps;
  }

  const finalState = state as BootstrapState;
  persistBootstrapState(cfg, finalState, mode);
  printSummary(finalState, cfg);
  return finalState;
}

async function runInteractiveMenu(cfg: Config): Promise<void> {
  const rl = createReadline();
  try {
    while (true) {
      console.log(`
DigitalOcean deploy menu
1) Bootstrap DOKS infrastructure
2) Bootstrap single droplet stack
3) Bootstrap two-droplet stack
4) Apply runtime config/secrets
5) Build and push images
6) Roll out images
7) Run migration
8) Smoke test
9) Show status
10) Full deploy
11) Print architecture variants
12) DOKS update / rollout only
13) Migrate droplets to DOKS
0) Exit
`);
      const choice = (await rl.question('Select an option: ')).trim();

      try {
        switch (choice) {
          case '1': {
            bootstrapInfrastructure(cfg);
            break;
          }
          case '2': {
            bootstrapInfrastructure(cfg, 'droplet-single');
            break;
          }
          case '3': {
            bootstrapInfrastructure(cfg, 'droplet-dual');
            break;
          }
          case '4': {
            const state = bootstrapInfrastructure(cfg);
            applyRuntimeConfigAndSecrets(cfg, state);
            break;
          }
          case '5': {
            const tag = await prompt(rl, 'Image tag', currentGitSha());
            buildAndPushImages(cfg, tag);
            break;
          }
          case '6': {
            const tag = await prompt(rl, 'Image tag', currentGitSha());
            rolloutImages(cfg, tag);
            break;
          }
          case '7': {
            const state = bootstrapInfrastructure(cfg);
            const name = await prompt(rl, 'Migration name', `deploy-${new Date().toISOString().slice(0, 10)}`);
            runMigration(cfg, state, name);
            break;
          }
          case '8':
            smokeTest(cfg);
            break;
          case '9':
            showStatus(cfg);
            break;
          case '10': {
            deployAll(cfg);
            break;
          }
          case '11':
            printArchitecturePlans();
            break;
          case '12': {
            const state = bootstrapInfrastructure(cfg);
            applyRuntimeConfigAndSecrets(cfg, state);
            buildAndPushImages(cfg);
            runMigration(cfg, state, `deploy-${new Date().toISOString().slice(0, 10)}`);
            rolloutImages(cfg);
            smokeTest(cfg);
            break;
          }
          case '13': {
            const state = bootstrapInfrastructure(cfg);
            applyRuntimeConfigAndSecrets(cfg, state);
            buildAndPushImages(cfg);
            runMigration(cfg, state, `migrate-${new Date().toISOString().slice(0, 10)}`);
            rolloutImages(cfg);
            smokeTest(cfg);
            break;
          }
          case '0':
          case 'q':
          case 'quit':
          case 'exit':
            return;
          default:
            console.log('Unknown option. Choose 0-13.');
        }
      } catch (error) {
        console.error(error instanceof Error ? error.message : String(error));
      }

      const continueLoop = await promptConfirm(rl, 'Return to menu?', true);
      if (!continueLoop) {
        return;
      }
    }
  } finally {
    rl.close();
  }
}

function printSummary(state: BootstrapState, cfg: Config): void {
  console.log('\nBootstrap complete.');
  console.log('Keep the following connection strings and credentials safe. They are printed only here:');
  console.log(`PROJECT_ID=${state.projectId}`);
  console.log(`VPC_ID=${state.vpcId}`);
  console.log(`REGISTRY_NAME=${state.registryName}`);
  console.log(`POSTGRES_ID=${state.postgresId}`);
  console.log(`POSTGRES_URI=${state.postgresUri}`);
  console.log(`REDIS_ID=${state.redisId}`);
  console.log(`REDIS_URI=${state.redisUri}`);
  console.log(`SPACES_ACCESS_KEY=${state.spacesAccessKey}`);
  if (state.spacesSecretKey) {
    console.log(`SPACES_SECRET_KEY=${state.spacesSecretKey}`);
  }
  if (state.clusterId) {
    console.log(`CLUSTER_ID=${state.clusterId}`);
    console.log('\nNext steps:');
    console.log(`1. Export the database and Redis URIs into your app runtime secrets.`);
    console.log(`2. Add GitHub App, JWT, Stripe, and S3 env vars for ${cfg.namespace}.`);
    console.log(`3. Deploy the app workload manifests or the production overlay.`);
    console.log(`4. Point Cloudflare DNS at the ingress/load balancer for ${cfg.region}.`);
    return;
  }

  console.log(`DROPLET_IDS=${(state.dropletIds ?? []).join(',')}`);
  console.log(`DROPLET_PUBLIC_IPS=${(state.dropletPublicIps ?? []).join(',')}`);
  console.log('\nNext steps:');
  console.log(`1. Point Cloudflare DNS at the droplet public IPs or proxy layer.`);
  console.log(`2. Verify the containers are healthy with SSH and docker compose ps.`);
  console.log(`3. Keep this mode as an interim production path until you move to DOKS.`);
}

function persistBootstrapState(cfg: Config, state: BootstrapState, mode: DeploymentMode): void {
  saveDeploymentState({
    mode,
    updatedAt: new Date().toISOString(),
    lastAppliedMigration: undefined,
    projectName: cfg.projectName,
    projectId: state.projectId,
    region: cfg.region,
    spacesRegion: cfg.spacesRegion,
    vpcName: cfg.vpcName,
    vpcId: state.vpcId,
    registryName: cfg.registryName,
    namespace: cfg.namespace,
    clusterName: cfg.clusterName,
    clusterId: state.clusterId,
    postgresName: cfg.postgresName,
    postgresId: state.postgresId,
    postgresUri: state.postgresUri,
    redisName: cfg.redisName,
    redisId: state.redisId,
    redisUri: state.redisUri,
    spacesBucket: cfg.spacesBucket,
    spacesKeyName: cfg.spacesKeyName,
    spacesAccessKey: state.spacesAccessKey,
    dropletIds: state.dropletIds,
    dropletPublicIps: state.dropletPublicIps,
  });
  console.log(`Saved deployment state to .vibescan/digitalocean-state.json`);
}

async function main(): Promise<void> {
  const invocation = parseArgs(process.argv.slice(2));
  const cfg = invocation.config;

  switch (invocation.command) {
    case 'menu':
      await runInteractiveMenu(cfg);
      break;
    case 'bootstrap':
      bootstrapInfrastructure(cfg);
      break;
    case 'droplet-single':
      bootstrapInfrastructure(cfg, 'droplet-single');
      break;
    case 'droplet-dual':
      bootstrapInfrastructure(cfg, 'droplet-dual');
      break;
    case 'secrets': {
      const state = bootstrapInfrastructure(cfg);
      applyRuntimeConfigAndSecrets(cfg, state);
      break;
    }
    case 'build':
      buildAndPushImages(cfg);
      break;
    case 'deploy': {
      const state = bootstrapInfrastructure(cfg);
      applyRuntimeConfigAndSecrets(cfg, state);
      rolloutImages(cfg);
      break;
    }
    case 'migrate': {
      const state = bootstrapInfrastructure(cfg);
      runMigration(cfg, state, `deploy-${new Date().toISOString().slice(0, 10)}`);
      break;
    }
    case 'smoke':
      smokeTest(cfg);
      break;
    case 'status':
      showStatus(cfg);
      break;
    case 'full':
      deployAll(cfg);
      break;
    case 'plans':
      printArchitecturePlans();
      break;
    default:
      bootstrapInfrastructure(cfg);
      break;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
