import { createAction } from './core';
// PUBLIC API
export const updateIsUserAdminById = createAction('operations/update-is-user-admin-by-id', ['User']);
// PUBLIC API
export const updateUserSettings = createAction('operations/update-user-settings', ['User']);
// PUBLIC API
export const refreshToken = createAction('operations/refresh-token', []);
// PUBLIC API
export const generateApiKey = createAction('operations/generate-api-key', ['User', 'ApiKey']);
// PUBLIC API
export const revokeApiKey = createAction('operations/revoke-api-key', ['User', 'ApiKey']);
// PUBLIC API
export const submitScan = createAction('operations/submit-scan', ['User', 'Scan', 'Finding', 'FindingHistory', 'ScanDelta']);
// PUBLIC API
export const generateCveRemediation = createAction('operations/generate-cve-remediation', ['User', 'Scan', 'Finding', 'AiFixPrompt', 'RemediationPromptUsage', 'RegionPolicy', 'UserPolicyOverride']);
// PUBLIC API
export const createScanSavedView = createAction('operations/create-scan-saved-view', ['User']);
// PUBLIC API
export const updateScanSavedView = createAction('operations/update-scan-saved-view', ['User']);
// PUBLIC API
export const deleteScanSavedView = createAction('operations/delete-scan-saved-view', ['User']);
// PUBLIC API
export const bulkCancelScans = createAction('operations/bulk-cancel-scans', ['User', 'Scan', 'ScanDelta']);
// PUBLIC API
export const bulkRerunScans = createAction('operations/bulk-rerun-scans', ['User', 'Scan', 'ScanDelta']);
// PUBLIC API
export const exportScans = createAction('operations/export-scans', ['User', 'Scan']);
// PUBLIC API
export const generateReportPDF = createAction('operations/generate-report-pdf', ['User', 'Scan']);
// PUBLIC API
export const upsertFindingAnnotation = createAction('operations/upsert-finding-annotation', ['User', 'Scan', 'Finding', 'VulnAcceptance']);
// PUBLIC API
export const createWebhook = createAction('operations/create-webhook', ['User', 'Webhook']);
// PUBLIC API
export const updateWebhook = createAction('operations/update-webhook', ['User', 'Webhook', 'WebhookDelivery']);
// PUBLIC API
export const deleteWebhook = createAction('operations/delete-webhook', ['User', 'Webhook', 'WebhookDelivery']);
// PUBLIC API
export const testWebhookDelivery = createAction('operations/test-webhook-delivery', ['User', 'Webhook', 'WebhookDelivery', 'Scan', 'ScanDelta']);
// PUBLIC API
export const retryWebhookDelivery = createAction('operations/retry-webhook-delivery', ['User', 'Webhook', 'WebhookDelivery']);
// PUBLIC API
export const generateCheckoutSession = createAction('operations/generate-checkout-session', ['User']);
// PUBLIC API
export const switchWorkspace = createAction('operations/switch-workspace', ['User', 'Workspace', 'WorkspaceMembership', 'Organization', 'Team']);
// PUBLIC API
export const completeOnboarding = createAction('operations/complete-onboarding', ['User']);
// PUBLIC API
export const linkGithubInstallation = createAction('operations/link-github-installation', ['User', 'GithubInstallation', 'Workspace', 'WorkspaceMembership', 'Organization']);
// PUBLIC API
export const updateGithubInstallationSettings = createAction('operations/update-github-installation-settings', ['User', 'GithubInstallation', 'Workspace', 'WorkspaceMembership', 'Organization']);
// PUBLIC API
export const updateProfileSettings = createAction('operations/update-profile-settings', ['User', 'Organization']);
// PUBLIC API
export const updateNotificationSettings = createAction('operations/update-notification-settings', ['User']);
// PUBLIC API
export const updateScannerAccessSettings = createAction('operations/update-scanner-access-settings', ['User']);
//# sourceMappingURL=index.js.map