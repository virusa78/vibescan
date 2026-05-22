import { prisma } from 'wasp/server'

import { bulkCancelScans } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (bulkCancelScans as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      ScanDelta: prisma.scanDelta,
    },
  })
}
