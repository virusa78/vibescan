import { prisma } from 'wasp/server'

import { getReportSummary } from '../../../../../src/server/operations/reportOperations'


export default async function (args, context) {
  return (getReportSummary as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
    },
  })
}
