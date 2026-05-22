import { prisma } from 'wasp/server'

import { listWebhooks } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (listWebhooks as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
    },
  })
}
