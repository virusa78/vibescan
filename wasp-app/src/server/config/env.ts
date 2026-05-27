import * as z from 'zod';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
};

const jwtSecretSchema = z.string().trim().min(1, 'JWT_SECRET is required');
const encryptionKeySchema = z
  .string()
  .trim()
  .length(64, 'ENCRYPTION_KEY must be exactly 64 characters (hex-encoded 32-byte key)');
const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');
const workerRoleSchema = z.preprocess(
  (value) => typeof value === 'string' ? value.trim().toLowerCase() : value,
  z.enum(['free', 'enterprise']).default('free'),
);
const embedWorkersSchema = z.preprocess(
  (value) => typeof value === 'string' ? value.trim().toLowerCase() : value,
  z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value !== 'false'),
);
const optionalUrlSchema = z.preprocess(emptyStringToUndefined, z.string().url().optional());
const optionalStringSchema = z.preprocess(emptyStringToUndefined, z.string().trim().optional());
const redisPortSchema = z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().default(6379));

export const serverCoreEnvValidationSchema = z.object({
  JWT_SECRET: jwtSecretSchema,
  ENCRYPTION_KEY: encryptionKeySchema,
  NODE_ENV: nodeEnvSchema.optional(),
  REDIS_URL: optionalUrlSchema,
  REDIS_HOST: optionalStringSchema,
  REDIS_PORT: redisPortSchema.optional(),
  WASP_SERVER_URL: optionalUrlSchema,
  API_URL: optionalUrlSchema,
  VITE_API_PROXY_TARGET: optionalUrlSchema,
  REACT_APP_API_URL: optionalUrlSchema,
  NEXT_PUBLIC_API_URL: optionalUrlSchema,
  WASP_WEB_CLIENT_URL: optionalUrlSchema,
  FRONTEND_URL: optionalUrlSchema,
  VIBESCAN_EMBED_WORKERS: z.preprocess(emptyStringToUndefined, z.string().optional()),
  WORKER_ROLE: z.preprocess(emptyStringToUndefined, z.string().optional()),
  VIBESCAN_ENABLE_SNYK_SCANNER: z.preprocess(emptyStringToUndefined, z.string().optional()),
  VIBESCAN_SNYK_CREDENTIAL_MODE: z.preprocess(emptyStringToUndefined, z.string().optional()),
  SNYK_TOKEN: optionalStringSchema,
  SNYK_ORG_ID: optionalStringSchema,
  SNYK_RUNTIME: optionalStringSchema,
  SNYK_COMMAND: optionalStringSchema,
  SNYK_TIMEOUT_MS: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  SNYK_SSH_HOST: optionalStringSchema,
  SNYK_SSH_USER: optionalStringSchema,
  SNYK_SSH_PORT: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  SNYK_SSH_IDENTITY_FILE: optionalStringSchema,
  SNYK_SSH_REMOTE_TMP_DIR: optionalStringSchema,
  ZOHO_CLIENT_ID: optionalStringSchema,
  ZOHO_CLIENT_SECRET: optionalStringSchema,
  ZOHO_REDIRECT_URI: optionalStringSchema,
  ZOHO_ACCOUNTS_BASE_URL: optionalUrlSchema,
  ZOHO_API_BASE_URL: optionalUrlSchema,
  ZOHO_RECONCILIATION_INTERVAL_MS: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  ZOHO_STALE_SYNC_THRESHOLD_MS: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().optional()),
  HUBSPOT_CLIENT_ID: optionalStringSchema,
  HUBSPOT_CLIENT_SECRET: optionalStringSchema,
  HUBSPOT_REDIRECT_URI: optionalStringSchema,
  HUBSPOT_SERVICE_KEY: optionalStringSchema,
  FREE_SCAN_CONCURRENCY: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().default(20)).optional(),
  ENTERPRISE_SCAN_CONCURRENCY: z.preprocess(emptyStringToUndefined, z.coerce.number().int().positive().default(3)).optional(),
  OWASP_NO_UPDATE: z.preprocess(emptyStringToUndefined, z.string().optional()),
  NVD_API_KEY: optionalStringSchema,
  VIBESCAN_UPLOAD_PREFIX_PATTERN: optionalStringSchema,
});

export function getJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  return jwtSecretSchema.parse(env.JWT_SECRET);
}

export function getEncryptionKeyHex(env: NodeJS.ProcessEnv = process.env): string {
  return encryptionKeySchema.parse(env.ENCRYPTION_KEY);
}

export function getEncryptionKeyBuffer(env: NodeJS.ProcessEnv = process.env): Buffer {
  return Buffer.from(getEncryptionKeyHex(env), 'hex');
}

export function getNodeEnv(env: NodeJS.ProcessEnv = process.env): 'development' | 'test' | 'production' {
  return nodeEnvSchema.parse(env.NODE_ENV);
}

export function isTestEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return getNodeEnv(env) === 'test';
}

export function isProductionEnvironment(env: NodeJS.ProcessEnv = process.env): boolean {
  return getNodeEnv(env) === 'production';
}

export function shouldEmbedWorkersFromEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  return embedWorkersSchema.parse(env.VIBESCAN_EMBED_WORKERS);
}

export function getWorkerRole(env: NodeJS.ProcessEnv = process.env): 'free' | 'enterprise' {
  return workerRoleSchema.parse(env.WORKER_ROLE);
}

export function getRedisHost(env: NodeJS.ProcessEnv = process.env): string {
  return optionalStringSchema.parse(env.REDIS_HOST) || '127.0.0.1';
}

export function getRedisPort(env: NodeJS.ProcessEnv = process.env): number {
  return redisPortSchema.parse(env.REDIS_PORT);
}

export function getZohoClientId(env: NodeJS.ProcessEnv = process.env): string | null {
  return optionalStringSchema.parse(env.ZOHO_CLIENT_ID) ?? null;
}

export function getZohoClientSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return optionalStringSchema.parse(env.ZOHO_CLIENT_SECRET) ?? null;
}

export function getZohoRedirectUri(env: NodeJS.ProcessEnv = process.env): string | null {
  return optionalStringSchema.parse(env.ZOHO_REDIRECT_URI) ?? null;
}

export function getZohoAccountsBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return optionalUrlSchema.parse(env.ZOHO_ACCOUNTS_BASE_URL) || 'https://accounts.zoho.com';
}

export function getZohoApiBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return optionalUrlSchema.parse(env.ZOHO_API_BASE_URL) || 'https://www.zohoapis.com';
}

export function getZohoReconciliationIntervalMs(env: NodeJS.ProcessEnv = process.env): number {
  return z.coerce.number().int().positive().default(15 * 60 * 1000).parse(env.ZOHO_RECONCILIATION_INTERVAL_MS);
}

export function getZohoStaleSyncThresholdMs(env: NodeJS.ProcessEnv = process.env): number {
  return z.coerce.number().int().positive().default(6 * 60 * 60 * 1000).parse(env.ZOHO_STALE_SYNC_THRESHOLD_MS);
}

export function getHubspotClientId(env: NodeJS.ProcessEnv = process.env): string {
  const id = optionalStringSchema.parse(env.HUBSPOT_CLIENT_ID);
  if (!id) {
    throw new Error('HUBSPOT_CLIENT_ID is required for HubSpot integration');
  }
  return id;
}

export function getHubspotClientSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = optionalStringSchema.parse(env.HUBSPOT_CLIENT_SECRET);
  if (!secret) {
    throw new Error('HUBSPOT_CLIENT_SECRET is required for HubSpot integration');
  }
  return secret;
}

export function getHubspotRedirectUri(env: NodeJS.ProcessEnv = process.env): string {
  const uri = optionalStringSchema.parse(env.HUBSPOT_REDIRECT_URI);
  if (!uri) {
    throw new Error('HUBSPOT_REDIRECT_URI is required for HubSpot integration');
  }
  return uri;
}

export function getHubspotServiceKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return optionalStringSchema.parse(env.HUBSPOT_SERVICE_KEY) ?? null;
}
