import { prisma } from 'wasp/server'

import { completeOnboarding } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (completeOnboarding as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
