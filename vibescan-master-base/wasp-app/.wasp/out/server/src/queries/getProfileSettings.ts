import { prisma } from 'wasp/server'

import { getProfileSettings } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (getProfileSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Organization: prisma.organization,
    },
  })
}
