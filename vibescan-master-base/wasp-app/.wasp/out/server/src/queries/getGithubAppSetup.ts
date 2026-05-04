import { prisma } from 'wasp/server'

import { getGithubAppSetup } from '../../../../../src/server/operations/githubOperations'


export default async function (args, context) {
  return (getGithubAppSetup as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
    },
  })
}
