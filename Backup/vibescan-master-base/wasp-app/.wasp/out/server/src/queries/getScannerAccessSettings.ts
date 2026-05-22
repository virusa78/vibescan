import { prisma } from 'wasp/server'

import { getScannerAccessSettings } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (getScannerAccessSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
