import { createQuery } from './core';
// PUBLIC API
export const getPaginatedUsers = createQuery('operations/get-paginated-users', ['User']);
// PUBLIC API
export const listApiKeys = createQuery('operations/list-api-keys', ['User', 'ApiKey']);
// PUBLIC API
export const getAPIKeyDetails = createQuery('operations/get-apikey-details', ['User', 'ApiKey']);
// PUBLIC API
export const getScans = createQuery('operations/get-scans', ['User', 'Scan']);
// PUBLIC API
export const getScanById = createQuery('operations/get-scan-by-id', ['User', 'Scan']);
// PUBLIC API
export const getDashboardMetrics = createQuery('operations/get-dashboard-metrics', ['User', 'Scan', 'Finding']);
// PUBLIC API
export const getRecentScans = createQuery('operations/get-recent-scans', ['User', 'Scan', 'ScanResult']);
// PUBLIC API
export const getSeverityBreakdown = createQuery('operations/get-severity-breakdown', ['User', 'Finding']);
// PUBLIC API
export const getTrendSeries = createQuery('operations/get-trend-series', ['User', 'Scan', 'Finding', 'ScanDelta']);
// PUBLIC API
export const getQuotaStatus = createQuery('operations/get-quota-status', ['User', 'Scan']);
// PUBLIC API
export const listScanSavedViews = createQuery('operations/list-scan-saved-views', ['User']);
// PUBLIC API
export const getReport = createQuery('operations/get-report', ['User', 'Scan', 'Finding', 'VulnAcceptance']);
// PUBLIC API
export const getReportSummary = createQuery('operations/get-report-summary', ['User', 'Scan', 'Finding']);
// PUBLIC API
export const getCIDecision = createQuery('operations/get-cidecision', ['User', 'Scan', 'Finding']);
// PUBLIC API
export const listFindingAnnotations = createQuery('operations/list-finding-annotations', ['User', 'Scan', 'Finding', 'VulnAcceptance']);
// PUBLIC API
export const listWebhooks = createQuery('operations/list-webhooks', ['User', 'Webhook']);
// PUBLIC API
export const getWebhook = createQuery('operations/get-webhook', ['User', 'Webhook', 'WebhookDelivery']);
// PUBLIC API
export const listWebhookDeliveries = createQuery('operations/list-webhook-deliveries', ['User', 'Webhook', 'WebhookDelivery']);
// PUBLIC API
export const getCustomerPortalUrl = createQuery('operations/get-customer-portal-url', ['User']);
// PUBLIC API
export const getWorkspaceContext = createQuery('operations/get-workspace-context', ['User', 'Workspace', 'WorkspaceMembership', 'Organization', 'Team']);
// PUBLIC API
export const listWorkspaces = createQuery('operations/list-workspaces', ['User', 'Workspace', 'WorkspaceMembership', 'Organization', 'Team']);
// PUBLIC API
export const getProfileSettings = createQuery('operations/get-profile-settings', ['User', 'Organization']);
// PUBLIC API
export const getOnboardingState = createQuery('operations/get-onboarding-state', ['User', 'Scan', 'GithubInstallation', 'Workspace', 'WorkspaceMembership', 'Organization']);
// PUBLIC API
export const listGithubInstallations = createQuery('operations/list-github-installations', ['User', 'GithubInstallation', 'Workspace', 'Organization']);
// PUBLIC API
export const getGithubAppSetup = createQuery('operations/get-github-app-setup', ['User']);
// PUBLIC API
export const getNotificationSettings = createQuery('operations/get-notification-settings', ['User']);
// PUBLIC API
export const getScannerAccessSettings = createQuery('operations/get-scanner-access-settings', ['User']);
// PRIVATE API (used in SDK)
export { buildAndRegisterQuery } from './core';
//# sourceMappingURL=index.js.map