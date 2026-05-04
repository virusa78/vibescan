import { prisma } from 'wasp/server'

import { getRecentScans } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (getRecentScans as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      ScanResult: prisma.scanResult,
    },
  })
}
