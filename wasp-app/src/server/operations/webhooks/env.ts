import * as z from 'zod'

export const webhookEnvSchema = z.object({
  ENCRYPTION_KEY: z
    .string()
    .length(64, 'ENCRYPTION_KEY must be exactly 64 characters (hex-encoded 32-byte key, e.g., `openssl rand -hex 32`)')
    .describe('AES-256 encryption key for webhook signing secrets (hex-encoded 64 char string)'),
})
