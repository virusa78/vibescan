import { prisma } from 'wasp/server'

import { updateScannerAccessSettings } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (updateScannerAccessSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
