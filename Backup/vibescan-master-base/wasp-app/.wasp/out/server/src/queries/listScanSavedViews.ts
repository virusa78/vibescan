import { prisma } from 'wasp/server'

import { listScanSavedViews } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (listScanSavedViews as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
