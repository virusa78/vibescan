import { prisma } from 'wasp/server'

import { updateGithubInstallationSettings } from '../../../../../src/server/operations/githubOperations'


export default async function (args, context) {
  return (updateGithubInstallationSettings as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
    },
  })
}
