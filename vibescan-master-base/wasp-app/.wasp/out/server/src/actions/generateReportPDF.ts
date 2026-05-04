import { prisma } from 'wasp/server'

import { generateReportPDF } from '../../../../../src/server/operations/reportOperations'


export default async function (args, context) {
  return (generateReportPDF as any)(args, {
    ...context,
    entities: {
      User: prisma.user,
      Scan: prisma.scan,
    },
  })
}
