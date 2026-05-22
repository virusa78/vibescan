import { prisma } from 'wasp/server';
import { createUnauthenticatedOperation, createAuthenticatedOperation, } from '../wrappers.js';
import { updateIsUserAdminById as updateIsUserAdminById_ext } from 'wasp/src/user/operations';
import { updateUserSettings as updateUserSettings_ext } from 'wasp/src/user/operations';
import { refreshToken as refreshToken_ext } from 'wasp/src/server/operations/auth/refreshToken';
import { generateApiKey as generateApiKey_ext } from 'wasp/src/apiKeys/operations';
import { revokeApiKey as revokeApiKey_ext } from 'wasp/src/apiKeys/operations';
import { submitScan as submitScan_ext } from 'wasp/src/scans/operations';
import { generateCveRemediation as generateCveRemediation_ext } from 'wasp/src/server/operations/remediation/generateCveRemediation';
import { createScanSavedView as createScanSavedView_ext } from 'wasp/src/server/operations/dashboardOperations';
import { updateScanSavedView as updateScanSavedView_ext } from 'wasp/src/server/operations/dashboardOperations';
import { deleteScanSavedView as deleteScanSavedView_ext } from 'wasp/src/server/operations/dashboardOperations';
import { bulkCancelScans as bulkCancelScans_ext } from 'wasp/src/server/operations/dashboardOperations';
import { bulkRerunScans as bulkRerunScans_ext } from 'wasp/src/server/operations/dashboardOperations';
import { exportScans as exportScans_ext } from 'wasp/src/server/operations/dashboardOperations';
import { generateReportPDF as generateReportPDF_ext } from 'wasp/src/server/operations/reportOperations';
import { upsertFindingAnnotation as upsertFindingAnnotation_ext } from 'wasp/src/server/operations/reportOperations';
import { createWebhook as createWebhook_ext } from 'wasp/src/server/operations/webhookOperations';
import { updateWebhook as updateWebhook_ext } from 'wasp/src/server/operations/webhookOperations';
import { deleteWebhook as deleteWebhook_ext } from 'wasp/src/server/operations/webhookOperations';
import { testWebhookDelivery as testWebhookDelivery_ext } from 'wasp/src/server/operations/webhookOperations';
import { retryWebhookDelivery as retryWebhookDelivery_ext } from 'wasp/src/server/operations/webhookOperations';
import { generateCheckoutSession as generateCheckoutSession_ext } from 'wasp/src/payment/operations';
import { switchWorkspace as switchWorkspace_ext } from 'wasp/src/server/operations/workspaceOperations';
import { completeOnboarding as completeOnboarding_ext } from 'wasp/src/server/operations/settingsOperations';
import { linkGithubInstallation as linkGithubInstallation_ext } from 'wasp/src/server/operations/githubOperations';
import { updateGithubInstallationSettings as updateGithubInstallationSettings_ext } from 'wasp/src/server/operations/githubOperations';
import { updateProfileSettings as updateProfileSettings_ext } from 'wasp/src/server/operations/settingsOperations';
import { updateNotificationSettings as updateNotificationSettings_ext } from 'wasp/src/server/operations/settingsOperations';
import { updateScannerAccessSettings as updateScannerAccessSettings_ext } from 'wasp/src/server/operations/settingsOperations';
// PUBLIC API
export const updateIsUserAdminById = createAuthenticatedOperation(updateIsUserAdminById_ext, {
    User: prisma.user,
});
// PUBLIC API
export const updateUserSettings = createAuthenticatedOperation(updateUserSettings_ext, {
    User: prisma.user,
});
// PUBLIC API
export const refreshToken = createUnauthenticatedOperation(refreshToken_ext, {});
// PUBLIC API
export const generateApiKey = createAuthenticatedOperation(generateApiKey_ext, {
    User: prisma.user,
    ApiKey: prisma.apiKey,
});
// PUBLIC API
export const revokeApiKey = createAuthenticatedOperation(revokeApiKey_ext, {
    User: prisma.user,
    ApiKey: prisma.apiKey,
});
// PUBLIC API
export const submitScan = createAuthenticatedOperation(submitScan_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
    FindingHistory: prisma.findingHistory,
    ScanDelta: prisma.scanDelta,
});
// PUBLIC API
export const generateCveRemediation = createAuthenticatedOperation(generateCveRemediation_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
    AiFixPrompt: prisma.aiFixPrompt,
    RemediationPromptUsage: prisma.remediationPromptUsage,
    RegionPolicy: prisma.regionPolicy,
    UserPolicyOverride: prisma.userPolicyOverride,
});
// PUBLIC API
export const createScanSavedView = createAuthenticatedOperation(createScanSavedView_ext, {
    User: prisma.user,
});
// PUBLIC API
export const updateScanSavedView = createAuthenticatedOperation(updateScanSavedView_ext, {
    User: prisma.user,
});
// PUBLIC API
export const deleteScanSavedView = createAuthenticatedOperation(deleteScanSavedView_ext, {
    User: prisma.user,
});
// PUBLIC API
export const bulkCancelScans = createAuthenticatedOperation(bulkCancelScans_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    ScanDelta: prisma.scanDelta,
});
// PUBLIC API
export const bulkRerunScans = createAuthenticatedOperation(bulkRerunScans_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    ScanDelta: prisma.scanDelta,
});
// PUBLIC API
export const exportScans = createAuthenticatedOperation(exportScans_ext, {
    User: prisma.user,
    Scan: prisma.scan,
});
// PUBLIC API
export const generateReportPDF = createAuthenticatedOperation(generateReportPDF_ext, {
    User: prisma.user,
    Scan: prisma.scan,
});
// PUBLIC API
export const upsertFindingAnnotation = createAuthenticatedOperation(upsertFindingAnnotation_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
    VulnAcceptance: prisma.vulnAcceptance,
});
// PUBLIC API
export const createWebhook = createAuthenticatedOperation(createWebhook_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
});
// PUBLIC API
export const updateWebhook = createAuthenticatedOperation(updateWebhook_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
    WebhookDelivery: prisma.webhookDelivery,
});
// PUBLIC API
export const deleteWebhook = createAuthenticatedOperation(deleteWebhook_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
    WebhookDelivery: prisma.webhookDelivery,
});
// PUBLIC API
export const testWebhookDelivery = createAuthenticatedOperation(testWebhookDelivery_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
    WebhookDelivery: prisma.webhookDelivery,
    Scan: prisma.scan,
    ScanDelta: prisma.scanDelta,
});
// PUBLIC API
export const retryWebhookDelivery = createAuthenticatedOperation(retryWebhookDelivery_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
    WebhookDelivery: prisma.webhookDelivery,
});
// PUBLIC API
export const generateCheckoutSession = createAuthenticatedOperation(generateCheckoutSession_ext, {
    User: prisma.user,
});
// PUBLIC API
export const switchWorkspace = createAuthenticatedOperation(switchWorkspace_ext, {
    User: prisma.user,
    Workspace: prisma.workspace,
    WorkspaceMembership: prisma.workspaceMembership,
    Organization: prisma.organization,
    Team: prisma.team,
});
// PUBLIC API
export const completeOnboarding = createAuthenticatedOperation(completeOnboarding_ext, {
    User: prisma.user,
});
// PUBLIC API
export const linkGithubInstallation = createAuthenticatedOperation(linkGithubInstallation_ext, {
    User: prisma.user,
    GithubInstallation: prisma.githubInstallation,
    Workspace: prisma.workspace,
    WorkspaceMembership: prisma.workspaceMembership,
    Organization: prisma.organization,
});
// PUBLIC API
export const updateGithubInstallationSettings = createAuthenticatedOperation(updateGithubInstallationSettings_ext, {
    User: prisma.user,
    GithubInstallation: prisma.githubInstallation,
    Workspace: prisma.workspace,
    WorkspaceMembership: prisma.workspaceMembership,
    Organization: prisma.organization,
});
// PUBLIC API
export const updateProfileSettings = createAuthenticatedOperation(updateProfileSettings_ext, {
    User: prisma.user,
    Organization: prisma.organization,
});
// PUBLIC API
export const updateNotificationSettings = createAuthenticatedOperation(updateNotificationSettings_ext, {
    User: prisma.user,
});
// PUBLIC API
export const updateScannerAccessSettings = createAuthenticatedOperation(updateScannerAccessSettings_ext, {
    User: prisma.user,
});
//# sourceMappingURL=index.js.map