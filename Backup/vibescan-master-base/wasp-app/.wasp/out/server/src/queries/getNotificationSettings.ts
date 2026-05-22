import { prisma } from 'wasp/server'

import { getNotificationSettings } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (getNotificationSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
