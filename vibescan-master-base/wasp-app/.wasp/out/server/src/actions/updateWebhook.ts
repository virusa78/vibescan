import { prisma } from 'wasp/server'

import { updateWebhook } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (updateWebhook as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  })
}
