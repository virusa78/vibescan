import { prisma } from 'wasp/server';
import { createAuthenticatedOperation, } from '../wrappers.js';
import { getPaginatedUsers as getPaginatedUsers_ext } from 'wasp/src/user/operations';
import { listApiKeys as listApiKeys_ext } from 'wasp/src/apiKeys/operations';
import { getAPIKeyDetails as getAPIKeyDetails_ext } from 'wasp/src/server/operations/apiKeyOperations';
import { getScans as getScans_ext } from 'wasp/src/scans/operations';
import { getScanById as getScanById_ext } from 'wasp/src/scans/operations';
import { getDashboardMetrics as getDashboardMetrics_ext } from 'wasp/src/server/operations/dashboardOperations';
import { getRecentScans as getRecentScans_ext } from 'wasp/src/server/operations/dashboardOperations';
import { getSeverityBreakdown as getSeverityBreakdown_ext } from 'wasp/src/server/operations/dashboardOperations';
import { getTrendSeries as getTrendSeries_ext } from 'wasp/src/server/operations/dashboardOperations';
import { getQuotaStatus as getQuotaStatus_ext } from 'wasp/src/server/operations/dashboardOperations';
import { listScanSavedViews as listScanSavedViews_ext } from 'wasp/src/server/operations/dashboardOperations';
import { getReport as getReport_ext } from 'wasp/src/server/operations/reportOperations';
import { getReportSummary as getReportSummary_ext } from 'wasp/src/server/operations/reportOperations';
import { getCIDecision as getCIDecision_ext } from 'wasp/src/server/operations/reportOperations';
import { listFindingAnnotations as listFindingAnnotations_ext } from 'wasp/src/server/operations/reportOperations';
import { listWebhooks as listWebhooks_ext } from 'wasp/src/server/operations/webhookOperations';
import { getWebhook as getWebhook_ext } from 'wasp/src/server/operations/webhookOperations';
import { listWebhookDeliveries as listWebhookDeliveries_ext } from 'wasp/src/server/operations/webhookOperations';
import { getCustomerPortalUrl as getCustomerPortalUrl_ext } from 'wasp/src/payment/operations';
import { getWorkspaceContext as getWorkspaceContext_ext } from 'wasp/src/server/operations/workspaceOperations';
import { listWorkspaces as listWorkspaces_ext } from 'wasp/src/server/operations/workspaceOperations';
import { getProfileSettings as getProfileSettings_ext } from 'wasp/src/server/operations/settingsOperations';
import { getOnboardingState as getOnboardingState_ext } from 'wasp/src/server/operations/settingsOperations';
import { listGithubInstallations as listGithubInstallations_ext } from 'wasp/src/server/operations/githubOperations';
import { getGithubAppSetup as getGithubAppSetup_ext } from 'wasp/src/server/operations/githubOperations';
import { getNotificationSettings as getNotificationSettings_ext } from 'wasp/src/server/operations/settingsOperations';
import { getScannerAccessSettings as getScannerAccessSettings_ext } from 'wasp/src/server/operations/settingsOperations';
// PUBLIC API
export const getPaginatedUsers = createAuthenticatedOperation(getPaginatedUsers_ext, {
    User: prisma.user,
});
// PUBLIC API
export const listApiKeys = createAuthenticatedOperation(listApiKeys_ext, {
    User: prisma.user,
    ApiKey: prisma.apiKey,
});
// PUBLIC API
export const getAPIKeyDetails = createAuthenticatedOperation(getAPIKeyDetails_ext, {
    User: prisma.user,
    ApiKey: prisma.apiKey,
});
// PUBLIC API
export const getScans = createAuthenticatedOperation(getScans_ext, {
    User: prisma.user,
    Scan: prisma.scan,
});
// PUBLIC API
export const getScanById = createAuthenticatedOperation(getScanById_ext, {
    User: prisma.user,
    Scan: prisma.scan,
});
// PUBLIC API
export const getDashboardMetrics = createAuthenticatedOperation(getDashboardMetrics_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
});
// PUBLIC API
export const getRecentScans = createAuthenticatedOperation(getRecentScans_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    ScanResult: prisma.scanResult,
});
// PUBLIC API
export const getSeverityBreakdown = createAuthenticatedOperation(getSeverityBreakdown_ext, {
    User: prisma.user,
    Finding: prisma.finding,
});
// PUBLIC API
export const getTrendSeries = createAuthenticatedOperation(getTrendSeries_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
    ScanDelta: prisma.scanDelta,
});
// PUBLIC API
export const getQuotaStatus = createAuthenticatedOperation(getQuotaStatus_ext, {
    User: prisma.user,
    Scan: prisma.scan,
});
// PUBLIC API
export const listScanSavedViews = createAuthenticatedOperation(listScanSavedViews_ext, {
    User: prisma.user,
});
// PUBLIC API
export const getReport = createAuthenticatedOperation(getReport_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
    VulnAcceptance: prisma.vulnAcceptance,
});
// PUBLIC API
export const getReportSummary = createAuthenticatedOperation(getReportSummary_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
});
// PUBLIC API
export const getCIDecision = createAuthenticatedOperation(getCIDecision_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
});
// PUBLIC API
export const listFindingAnnotations = createAuthenticatedOperation(listFindingAnnotations_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    Finding: prisma.finding,
    VulnAcceptance: prisma.vulnAcceptance,
});
// PUBLIC API
export const listWebhooks = createAuthenticatedOperation(listWebhooks_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
});
// PUBLIC API
export const getWebhook = createAuthenticatedOperation(getWebhook_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
    WebhookDelivery: prisma.webhookDelivery,
});
// PUBLIC API
export const listWebhookDeliveries = createAuthenticatedOperation(listWebhookDeliveries_ext, {
    User: prisma.user,
    Webhook: prisma.webhook,
    WebhookDelivery: prisma.webhookDelivery,
});
// PUBLIC API
export const getCustomerPortalUrl = createAuthenticatedOperation(getCustomerPortalUrl_ext, {
    User: prisma.user,
});
// PUBLIC API
export const getWorkspaceContext = createAuthenticatedOperation(getWorkspaceContext_ext, {
    User: prisma.user,
    Workspace: prisma.workspace,
    WorkspaceMembership: prisma.workspaceMembership,
    Organization: prisma.organization,
    Team: prisma.team,
});
// PUBLIC API
export const listWorkspaces = createAuthenticatedOperation(listWorkspaces_ext, {
    User: prisma.user,
    Workspace: prisma.workspace,
    WorkspaceMembership: prisma.workspaceMembership,
    Organization: prisma.organization,
    Team: prisma.team,
});
// PUBLIC API
export const getProfileSettings = createAuthenticatedOperation(getProfileSettings_ext, {
    User: prisma.user,
    Organization: prisma.organization,
});
// PUBLIC API
export const getOnboardingState = createAuthenticatedOperation(getOnboardingState_ext, {
    User: prisma.user,
    Scan: prisma.scan,
    GithubInstallation: prisma.githubInstallation,
    Workspace: prisma.workspace,
    WorkspaceMembership: prisma.workspaceMembership,
    Organization: prisma.organization,
});
// PUBLIC API
export const listGithubInstallations = createAuthenticatedOperation(listGithubInstallations_ext, {
    User: prisma.user,
    GithubInstallation: prisma.githubInstallation,
    Workspace: prisma.workspace,
    Organization: prisma.organization,
});
// PUBLIC API
export const getGithubAppSetup = createAuthenticatedOperation(getGithubAppSetup_ext, {
    User: prisma.user,
});
// PUBLIC API
export const getNotificationSettings = createAuthenticatedOperation(getNotificationSettings_ext, {
    User: prisma.user,
});
// PUBLIC API
export const getScannerAccessSettings = createAuthenticatedOperation(getScannerAccessSettings_ext, {
    User: prisma.user,
});
//# sourceMappingURL=index.js.map