import { prisma } from 'wasp/server'

import { listGithubInstallations } from '../../../../../src/server/operations/githubOperations'


export default async function (args, context) {
  return (listGithubInstallations as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      Organization: prisma.organization,
    },
  })
}
