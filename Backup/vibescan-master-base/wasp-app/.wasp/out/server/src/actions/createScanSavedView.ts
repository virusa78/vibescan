import { prisma } from 'wasp/server'

import { createScanSavedView } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (createScanSavedView as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
