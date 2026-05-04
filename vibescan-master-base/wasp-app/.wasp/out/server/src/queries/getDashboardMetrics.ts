import { prisma } from 'wasp/server'

import { getDashboardMetrics } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (getDashboardMetrics as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
    },
  })
}
