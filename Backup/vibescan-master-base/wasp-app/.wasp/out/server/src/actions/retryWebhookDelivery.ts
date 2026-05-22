import { prisma } from 'wasp/server'

import { retryWebhookDelivery } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (retryWebhookDelivery as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  })
}
