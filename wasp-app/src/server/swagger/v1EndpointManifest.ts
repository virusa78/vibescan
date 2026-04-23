import path from 'node:path';
import fs from 'node:fs';

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface V1EndpointManifestEntry {
  method: HttpMethod;
  path: string;
  operationId: string;
  requiresRequestBody: boolean;
  sourceFile: string;
}

function detectRepoRootFromCwd(): string {
  const cwd = process.cwd();
  if (fs.existsSync(path.resolve(cwd, 'wasp-app/main.wasp'))) {
    return cwd;
  }
  if (fs.existsSync(path.resolve(cwd, 'main.wasp'))) {
    return path.resolve(cwd, '..');
  }
  return cwd;
}

const repoRoot = detectRepoRootFromCwd();

const scansDocs = 'wasp-app/src/server/operations/scans/swagger-docs.ts';
const dashboardDocs = 'wasp-app/src/server/operations/dashboard/swagger-docs.ts';
const reportsDocs = 'wasp-app/src/server/operations/reports/swagger-docs.ts';
const webhooksDocs = 'wasp-app/src/server/operations/webhooks/swagger-docs.ts';
const apiKeysDocs = 'wasp-app/src/server/operations/apikeys/swagger-docs.ts';
const settingsDocs = 'wasp-app/src/server/operations/settings/swagger-docs.ts';

export const v1EndpointManifest: V1EndpointManifestEntry[] = [
  { method: 'post', path: '/api/v1/scans', operationId: 'submitScan', requiresRequestBody: true, sourceFile: scansDocs },
  { method: 'get', path: '/api/v1/scans', operationId: 'listScans', requiresRequestBody: false, sourceFile: scansDocs },
  { method: 'get', path: '/api/v1/scans/{scanId}', operationId: 'getScan', requiresRequestBody: false, sourceFile: scansDocs },
  { method: 'delete', path: '/api/v1/scans/{scanId}', operationId: 'cancelScan', requiresRequestBody: false, sourceFile: scansDocs },
  { method: 'get', path: '/api/v1/scans/stats', operationId: 'getScanStats', requiresRequestBody: false, sourceFile: scansDocs },

  { method: 'get', path: '/api/v1/dashboard/metrics', operationId: 'getDashboardMetrics', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'get', path: '/api/v1/dashboard/recent-scans', operationId: 'getRecentScans', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'get', path: '/api/v1/dashboard/severity-breakdown', operationId: 'getSeverityBreakdown', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'get', path: '/api/v1/dashboard/trends', operationId: 'getTrendSeries', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'get', path: '/api/v1/dashboard/quota', operationId: 'getQuotaStatus', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'get', path: '/api/v1/dashboard/saved-views', operationId: 'listSavedViews', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'post', path: '/api/v1/dashboard/saved-views', operationId: 'createSavedView', requiresRequestBody: true, sourceFile: dashboardDocs },
  { method: 'put', path: '/api/v1/dashboard/saved-views/{viewId}', operationId: 'updateSavedView', requiresRequestBody: true, sourceFile: dashboardDocs },
  { method: 'delete', path: '/api/v1/dashboard/saved-views/{viewId}', operationId: 'deleteSavedView', requiresRequestBody: false, sourceFile: dashboardDocs },
  { method: 'post', path: '/api/v1/dashboard/scans/bulk-cancel', operationId: 'bulkCancelScans', requiresRequestBody: true, sourceFile: dashboardDocs },
  { method: 'post', path: '/api/v1/dashboard/scans/bulk-rerun', operationId: 'bulkRerunScans', requiresRequestBody: true, sourceFile: dashboardDocs },
  { method: 'post', path: '/api/v1/dashboard/scans/export', operationId: 'exportScans', requiresRequestBody: true, sourceFile: dashboardDocs },

  { method: 'get', path: '/api/v1/reports/{scanId}', operationId: 'getReport', requiresRequestBody: false, sourceFile: reportsDocs },
  { method: 'get', path: '/api/v1/reports/{scanId}/summary', operationId: 'getReportSummary', requiresRequestBody: false, sourceFile: reportsDocs },
  { method: 'post', path: '/api/v1/reports/{scanId}/pdf', operationId: 'generateReportPDF', requiresRequestBody: true, sourceFile: reportsDocs },
  { method: 'get', path: '/api/v1/reports/{scanId}/ci-decision', operationId: 'getCIDecision', requiresRequestBody: false, sourceFile: reportsDocs },
  { method: 'get', path: '/api/v1/reports/{scanId}/annotations', operationId: 'listFindingAnnotations', requiresRequestBody: false, sourceFile: reportsDocs },
  { method: 'post', path: '/api/v1/reports/{scanId}/findings/{findingId}/annotation', operationId: 'upsertFindingAnnotation', requiresRequestBody: true, sourceFile: reportsDocs },

  { method: 'post', path: '/api/v1/webhooks', operationId: 'createWebhook', requiresRequestBody: true, sourceFile: webhooksDocs },
  { method: 'get', path: '/api/v1/webhooks', operationId: 'listWebhooks', requiresRequestBody: false, sourceFile: webhooksDocs },
  { method: 'get', path: '/api/v1/webhooks/{webhookId}', operationId: 'getWebhook', requiresRequestBody: false, sourceFile: webhooksDocs },
  { method: 'put', path: '/api/v1/webhooks/{webhookId}', operationId: 'updateWebhook', requiresRequestBody: true, sourceFile: webhooksDocs },
  { method: 'delete', path: '/api/v1/webhooks/{webhookId}', operationId: 'deleteWebhook', requiresRequestBody: false, sourceFile: webhooksDocs },
  { method: 'get', path: '/api/v1/webhooks/{webhookId}/deliveries', operationId: 'listWebhookDeliveries', requiresRequestBody: false, sourceFile: webhooksDocs },
  { method: 'post', path: '/api/v1/webhooks/{webhookId}/test', operationId: 'testWebhookDelivery', requiresRequestBody: false, sourceFile: webhooksDocs },
  { method: 'post', path: '/api/v1/webhooks/{webhookId}/deliveries/{deliveryId}/retry', operationId: 'retryWebhookDelivery', requiresRequestBody: false, sourceFile: webhooksDocs },

  { method: 'post', path: '/api/v1/api-keys', operationId: 'generateAPIKey', requiresRequestBody: true, sourceFile: apiKeysDocs },
  { method: 'get', path: '/api/v1/api-keys', operationId: 'listAPIKeys', requiresRequestBody: false, sourceFile: apiKeysDocs },
  { method: 'get', path: '/api/v1/api-keys/{keyId}', operationId: 'getAPIKeyDetails', requiresRequestBody: false, sourceFile: apiKeysDocs },
  { method: 'delete', path: '/api/v1/api-keys/{keyId}', operationId: 'revokeAPIKey', requiresRequestBody: false, sourceFile: apiKeysDocs },

  { method: 'get', path: '/api/v1/settings/profile', operationId: 'getProfileSettings', requiresRequestBody: false, sourceFile: settingsDocs },
  { method: 'post', path: '/api/v1/settings/profile', operationId: 'updateProfileSettings', requiresRequestBody: true, sourceFile: settingsDocs },
  { method: 'get', path: '/api/v1/settings/notifications', operationId: 'getNotificationSettings', requiresRequestBody: false, sourceFile: settingsDocs },
  { method: 'post', path: '/api/v1/settings/notifications', operationId: 'updateNotificationSettings', requiresRequestBody: true, sourceFile: settingsDocs },
  { method: 'get', path: '/api/v1/settings/scanner-access', operationId: 'getScannerAccessSettings', requiresRequestBody: false, sourceFile: settingsDocs },
  { method: 'post', path: '/api/v1/settings/scanner-access', operationId: 'updateScannerAccessSettings', requiresRequestBody: true, sourceFile: settingsDocs },
];

export function getV1ManifestSwaggerSourceFilesAbsolute(): string[] {
  const unique = new Set(v1EndpointManifest.map((entry) => path.resolve(repoRoot, entry.sourceFile)));
  return Array.from(unique).sort();
}

export function getV1FallbackSwaggerGlobsAbsolute(): string[] {
  return [
    path.resolve(repoRoot, 'wasp-app/src/server/operations/**/swagger-docs.ts'),
    path.resolve(repoRoot, 'wasp-app/src/payment/swagger-docs.ts'),
    path.resolve(repoRoot, 'wasp-app/src/auth/**/*.ts'),
    path.resolve(repoRoot, 'wasp-app/src/scans/**/*.ts'),
    path.resolve(repoRoot, 'wasp-app/src/apiKeys/**/*.ts'),
  ];
}

export function getRepoRoot(): string {
  return repoRoot;
}
