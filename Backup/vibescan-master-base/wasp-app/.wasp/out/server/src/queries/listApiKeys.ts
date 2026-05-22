import { prisma } from 'wasp/server'

import { listApiKeys } from '../../../../../src/apiKeys/operations'


export default async function (args, context) {
  return (listApiKeys as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  })
}
