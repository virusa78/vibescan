import { prisma } from 'wasp/server'

import { listFindingAnnotations } from '../../../../../src/server/operations/reportOperations'


export default async function (args, context) {
  return (listFindingAnnotations as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      VulnAcceptance: prisma.vulnAcceptance,
    },
  })
}
