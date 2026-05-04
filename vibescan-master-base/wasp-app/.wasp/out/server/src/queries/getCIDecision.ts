import { prisma } from 'wasp/server'

import { getCIDecision } from '../../../../../src/server/operations/reportOperations'


export default async function (args, context) {
  return (getCIDecision as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
    },
  })
}
