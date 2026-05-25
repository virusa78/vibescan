/* eslint-disable @typescript-eslint/no-explicit-any */
// Avoid importing '@jest/globals' directly to prevent circular require during jest.mock()
const jestRef: any = (globalThis as any).jest || require('@jest/globals').jest;

export class HttpError extends Error {
    statusCode: number;
    data?: Record<string, unknown>;

    constructor(statusCode: number, message: string, data?: Record<string, unknown>) {
        super(message);
        this.statusCode = statusCode;
        this.data = data;
    }
}

export const prisma = {
    apiKey: {
        findMany: jestRef.fn() as any,
        update: jestRef.fn() as any,
        findUnique: jestRef.fn() as any,
        delete: jestRef.fn() as any,
        create: jestRef.fn() as any,
    },
    apiKeyUsageEvent: {
        create: jestRef.fn() as any,
        count: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
    },
    aiFixPrompt: {
        findFirst: jestRef.fn() as any,
        findUnique: jestRef.fn() as any,
        count: jestRef.fn() as any,
        create: jestRef.fn() as any,
    },
    finding: {
        findMany: jestRef.fn() as any,
        findUnique: jestRef.fn() as any,
    },
    projectFinding: {
        count: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        findUnique: jestRef.fn() as any,
        create: jestRef.fn() as any,
    },
    projectNotificationSetting: {
        findUnique: jestRef.fn() as any,
        upsert: jestRef.fn() as any,
    },
    organization: {
        findFirst: jestRef.fn() as any,
        create: jestRef.fn() as any,
    },
    organizationMembership: {
        upsert: jestRef.fn() as any,
    },
    team: {
        findFirst: jestRef.fn() as any,
        create: jestRef.fn() as any,
    },
    teamMembership: {
        upsert: jestRef.fn() as any,
    },
    workspace: {
        findFirst: jestRef.fn() as any,
        create: jestRef.fn() as any,
        findUnique: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        count: jestRef.fn() as any,
    },
    zohoIntegration: {
        findUnique: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        upsert: jestRef.fn() as any,
    },
    crmIntegration: {
        findUnique: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        upsert: jestRef.fn() as any,
        update: jestRef.fn() as any,
    },
    workspaceMembership: {
        findFirst: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        upsert: jestRef.fn() as any,
    },
    scan: {
        findUnique: jestRef.fn() as any,
        findFirst: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        count: jestRef.fn() as any,
        update: jestRef.fn() as any,
        groupBy: jestRef.fn() as any,
    },
    scanDelta: {
        findMany: jestRef.fn() as any,
    },
    scannerUsageLedger: {
        count: jestRef.fn() as any,
        create: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
    },
    user: {
        findUnique: jestRef.fn() as any,
        update: jestRef.fn() as any,
        create: jestRef.fn() as any,
        delete: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        count: jestRef.fn() as any,
    },
    quotaLedger: {
        create: jestRef.fn() as any,
        findMany: jestRef.fn() as any,
        findFirst: jestRef.fn() as any,
        deleteMany: jestRef.fn() as any,
    },
    $transaction: jestRef.fn() as any,
};
