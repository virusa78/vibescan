import * as z from 'zod'

export const webhookEnvSchema = z.object({
  ENCRYPTION_KEY: z
    .string()
    .min(32, 'ENCRYPTION_KEY must be at least 32 characters (e.g., use `openssl rand -hex 16` to generate)')
    .describe('AES-256 encryption key for webhook signing secrets (hex or base64)'),
})
