import { prisma } from 'wasp/server'

import { getQuotaStatus } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (getQuotaStatus as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
    },
  })
}
