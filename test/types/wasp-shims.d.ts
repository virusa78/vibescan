/* eslint-disable @typescript-eslint/no-explicit-any */
declare module 'wasp/server' {
  export class HttpError extends Error {
    statusCode: number;
    data?: unknown;
    constructor(statusCode: number, message: string, data?: unknown);
  }
  export const prisma: any;
}

declare module 'wasp/server/api' {
  export type MiddlewareConfigFn = any;
}

declare module 'wasp/entities' {
  export type Scan = any;
  export type User = any;
}

declare module 'wasp/client/auth' {
  export const useAuth: any;
  export const logout: any;
}

declare module 'wasp/client/router' {
  export const Link: any;
  export const routes: any;
}

declare module 'wasp/client/operations' {
  export const getDashboardMetrics: any;
  export const getRecentScans: any;
  export const getTrendSeries: any;
  export const getSeverityBreakdown: any;
  export const getQuotaStatus: any;
  export const getReport: any;
  export const getReportSummary: any;
  export const getCIDecision: any;
  export const getProfileSettings: any;
  export const updateProfileSettings: any;
  export const getNotificationSettings: any;
  export const updateNotificationSettings: any;
  export const getScannerAccessSettings: any;
  export const updateScannerAccessSettings: any;
}

declare module '@prisma/client' {
  export class PrismaClient {
    constructor(...args: any[]);
    [key: string]: any;
  }
  export namespace Prisma {
    export type ScanOrderByWithRelationInput = Record<string, unknown>;
    export type InputJsonValue = unknown;
    export type ScanUpdateInput = Record<string, unknown>;
  }
  export type ScanResult = any;
  export type ScanSource = 'grype' | 'codescoring_johnny' | 'snyk';
}
