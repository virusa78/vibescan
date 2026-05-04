import { prisma } from 'wasp/server'

import { getSeverityBreakdown } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (getSeverityBreakdown as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Finding: prisma.finding,
    },
  })
}
