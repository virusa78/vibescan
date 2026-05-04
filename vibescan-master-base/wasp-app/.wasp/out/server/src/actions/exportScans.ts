import { prisma } from 'wasp/server'

import { exportScans } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (exportScans as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
    },
  })
}
