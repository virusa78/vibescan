import { prisma } from 'wasp/server'

import { updateScanSavedView } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (updateScanSavedView as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
