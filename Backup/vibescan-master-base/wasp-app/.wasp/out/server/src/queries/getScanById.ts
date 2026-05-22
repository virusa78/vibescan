import { prisma } from 'wasp/server'

import { getScanById } from '../../../../../src/scans/operations'


export default async function (args, context) {
  return (getScanById as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
    },
  })
}
