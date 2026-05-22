import { prisma } from 'wasp/server'

import { testWebhookDelivery } from '../../../../../src/server/operations/webhookOperations'


export default async function (args, context) {
  return (testWebhookDelivery as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
      Scan: prisma.scan,
      ScanDelta: prisma.scanDelta,
    },
  })
}
