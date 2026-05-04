import { prisma } from 'wasp/server'

import { getOnboardingState } from '../../../../../src/server/operations/settingsOperations'


export default async function (args, context) {
  return (getOnboardingState as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
    },
  })
}
