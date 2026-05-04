import { prisma } from 'wasp/server'

import { updateProfileSettings } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (updateProfileSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Organization: prisma.organization,
    },
  })
}
