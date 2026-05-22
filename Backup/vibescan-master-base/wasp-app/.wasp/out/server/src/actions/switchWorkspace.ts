import { prisma } from 'wasp/server'

import { switchWorkspace } from '../../../../../src/server/operations/workspaceOperations'


export default async function (args, context) {
  return (switchWorkspace as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
      Team: prisma.team,
    },
  })
}
