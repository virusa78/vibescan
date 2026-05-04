import { prisma } from 'wasp/server'

import { deleteWebhook } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (deleteWebhook as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  })
}
