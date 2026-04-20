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
