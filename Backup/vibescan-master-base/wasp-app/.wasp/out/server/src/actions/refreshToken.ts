import { prisma } from 'wasp/server'

import { refreshToken } from '../../../../../src/server/operations/auth/refreshToken'


export default async function (args, context) {
  return (refreshToken as any)(args, {
    ...context,
    entities: {
    },
  })
}
