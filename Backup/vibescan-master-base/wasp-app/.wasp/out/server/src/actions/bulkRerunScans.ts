import { prisma } from 'wasp/server'

import { bulkRerunScans } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (bulkRerunScans as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      ScanDelta: prisma.scanDelta,
    },
  })
}
