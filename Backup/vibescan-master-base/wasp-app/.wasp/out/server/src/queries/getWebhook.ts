import { prisma } from 'wasp/server'

import { getWebhook } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (getWebhook as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  })
}
