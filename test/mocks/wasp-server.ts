/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

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
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        update: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        delete: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    apiKeyUsageEvent: {
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        count: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    aiFixPrompt: {
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        count: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    finding: {
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    projectNotificationSetting: {
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        upsert: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    organization: {
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    organizationMembership: {
        upsert: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    team: {
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    teamMembership: {
        upsert: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    workspace: {
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    workspaceMembership: {
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        upsert: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    scan: {
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        count: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        update: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    scanDelta: {
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    user: {
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        update: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        delete: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    quotaLedger: {
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        deleteMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    $transaction: jest.fn() as jest.MockedFunction<() => Promise<any>>,
};
