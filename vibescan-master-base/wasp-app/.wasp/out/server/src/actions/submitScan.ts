import { prisma } from 'wasp/server'

import { submitScan } from '../../../../../src/scans/operations'


export default async function (args, context) {
  return (submitScan as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      FindingHistory: prisma.findingHistory,
      ScanDelta: prisma.scanDelta,
    },
  })
}
