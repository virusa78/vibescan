import { prisma } from 'wasp/server'

import { updateUserSettings } from '../../../../../src/user/operations'


export default async function (args, context) {
  return (updateUserSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
