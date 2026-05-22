import { prisma } from 'wasp/server'

import { getScans } from '../../../../../src/scans/operations'


export default async function (args, context) {
  return (getScans as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
    },
  })
}
