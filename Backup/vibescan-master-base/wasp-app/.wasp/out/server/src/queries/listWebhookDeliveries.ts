import { prisma } from 'wasp/server'

import { listWebhookDeliveries } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (listWebhookDeliveries as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  })
}
