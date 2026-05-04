import { prisma } from 'wasp/server'

import { getAPIKeyDetails } from '../../../../../src/server/operations/apiKeyOperations'


export default async function (args, context) {
  return (getAPIKeyDetails as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  })
}
