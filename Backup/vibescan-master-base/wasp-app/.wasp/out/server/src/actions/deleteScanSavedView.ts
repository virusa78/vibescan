import { prisma } from 'wasp/server'

import { deleteScanSavedView } from '../../../../../src/server/operations/dashboardOperations'


export default async function (args, context) {
  return (deleteScanSavedView as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
