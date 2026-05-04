import { prisma } from 'wasp/server'

import { generateCveRemediation } from '../../../../../src/server/operations/remediation/generateCveRemediation'


export default async function (args, context) {
  return (generateCveRemediation as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      AiFixPrompt: prisma.aiFixPrompt,
      RemediationPromptUsage: prisma.remediationPromptUsage,
      RegionPolicy: prisma.regionPolicy,
      UserPolicyOverride: prisma.userPolicyOverride,
    },
  })
}
