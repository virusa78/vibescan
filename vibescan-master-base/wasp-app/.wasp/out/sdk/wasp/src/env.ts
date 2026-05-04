import { defineEnvValidationSchema } from 'wasp/env'

import { authEnvSchema } from './auth/env'
import { stripeEnvSchema } from './payment/stripe/env'
import { webhookEnvSchema } from './server/operations/webhooks/env'
import { serverCoreEnvValidationSchema } from './server/config/env'
import { githubAppEnvSchema } from './server/services/githubAppEnv'

// Wasp merges this schema with its built-in env var validations and uses it
// to validate `process.env` at server startup. Access the validated env vars
// with `import { env } from 'wasp/server'` instead of using `process.env` directly.
// https://wasp.sh/docs/project/env-vars#custom-env-var-validations
export const serverEnvValidationSchema = defineEnvValidationSchema(
  authEnvSchema
    .merge(serverCoreEnvValidationSchema)
    .merge(stripeEnvSchema)
    .merge(webhookEnvSchema)
    .merge(githubAppEnvSchema)
)
