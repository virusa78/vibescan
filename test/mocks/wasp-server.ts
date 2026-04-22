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
    scan: {
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findFirst: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        count: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    scanDelta: {
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    user: {
        findUnique: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        update: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    quotaLedger: {
        create: jest.fn() as jest.MockedFunction<() => Promise<any>>,
        findMany: jest.fn() as jest.MockedFunction<() => Promise<any>>,
    },
    $transaction: jest.fn() as jest.MockedFunction<() => Promise<any>>,
};
