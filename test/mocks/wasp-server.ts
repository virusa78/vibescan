/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from '@prisma/client';

// Avoid importing '@jest/globals' directly to prevent circular require during jest.mock()
const jestRef: any = (globalThis as any).jest || require('@jest/globals').jest;

const isIntegrationTest = () => {
  try {
    const testPath = (globalThis as any).expect?.getState()?.testPath;
    return !!(testPath && (testPath.includes('/test/integration/') || testPath.includes('test/integration/')));
  } catch (e) {
    return false;
  }
};

const useRealDb = !!process.env.DATABASE_URL;
const realPrisma = useRealDb ? new PrismaClient() : null;

export class HttpError extends Error {
    statusCode: number;
    data?: Record<string, unknown>;

    constructor(statusCode: number, message: string, data?: Record<string, unknown>) {
        super(message);
        this.statusCode = statusCode;
        this.data = data;
    }
}

const rawMockPrisma: any = {
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

const modelProxies = new WeakMap<any, any>();

function getModelProxy(modelName: string, mockModel: any) {
  if (modelProxies.has(mockModel)) {
    return modelProxies.get(mockModel);
  }

  const modelProxy = new Proxy(mockModel, {
    get(target, prop, receiver) {
      if (useRealDb && isIntegrationTest() && realPrisma && (realPrisma as any)[modelName]) {
        const realModel = (realPrisma as any)[modelName];
        if (prop in realModel && typeof realModel[prop] === 'function') {
          const originalValue = Reflect.get(target, prop, receiver);
          if (originalValue && typeof originalValue.mockImplementation === 'function') {
            originalValue.mockImplementation((...args: any[]) => {
              return realModel[prop](...args);
            });
            return originalValue;
          }
          return realModel[prop].bind(realModel);
        }
      }

      const val = Reflect.get(target, prop, receiver);
      if (val === undefined && typeof prop === 'string') {
        target[prop] = jestRef.fn() as any;
        return target[prop];
      }
      return val;
    }
  });

  modelProxies.set(mockModel, modelProxy);
  return modelProxy;
}

export const prisma = new Proxy(rawMockPrisma, {
  get(target, prop, receiver) {
    if (prop === '$transaction') {
      if (useRealDb && isIntegrationTest() && realPrisma) {
        target.$transaction.mockImplementation((arg: any) => {
          return realPrisma.$transaction(arg);
        });
      }
      return target.$transaction;
    }

    if (prop === '$connect' || prop === '$disconnect') {
      return useRealDb && isIntegrationTest() && realPrisma
        ? (realPrisma as any)[prop].bind(realPrisma)
        : () => Promise.resolve();
    }

    const value = Reflect.get(target, prop, receiver);
    if (value && typeof value === 'object' && typeof prop === 'string') {
      return getModelProxy(prop, value);
    }
    if (value === undefined && typeof prop === 'string') {
      // Dynamic proxy for models not explicitly mocked
      target[prop] = {};
      return getModelProxy(prop, target[prop]);
    }
    return value;
  }
});
