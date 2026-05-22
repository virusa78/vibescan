import { prisma } from 'wasp/server'

import { createWebhook } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (createWebhook as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
    },
  })
}
