import { prisma } from 'wasp/server'

import { updateNotificationSettings } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (updateNotificationSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
