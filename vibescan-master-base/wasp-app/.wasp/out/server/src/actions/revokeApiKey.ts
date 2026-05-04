import { prisma } from 'wasp/server'

import { revokeApiKey } from '../../../../../src/apiKeys/operations'


export default async function (args, context) {
  return (revokeApiKey as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  })
}
