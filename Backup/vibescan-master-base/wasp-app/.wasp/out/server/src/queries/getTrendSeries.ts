import { prisma } from 'wasp/server'

import { getTrendSeries } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (getTrendSeries as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      ScanDelta: prisma.scanDelta,
    },
  })
}
