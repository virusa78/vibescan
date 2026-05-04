import { prisma } from 'wasp/server'

import { generateApiKey } from '../../../../../src/apiKeys/operations'


export default async function (args, context) {
  return (generateApiKey as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  })
}
