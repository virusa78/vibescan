import { type QueryFor, createQuery } from './core'
import { GetPaginatedUsers_ext } from 'wasp/server/operations/queries'
import { ListApiKeys_ext } from 'wasp/server/operations/queries'
import { GetAPIKeyDetails_ext } from 'wasp/server/operations/queries'
import { GetScans_ext } from 'wasp/server/operations/queries'
import { GetScanById_ext } from 'wasp/server/operations/queries'
import { GetDashboardMetrics_ext } from 'wasp/server/operations/queries'
import { GetRecentScans_ext } from 'wasp/server/operations/queries'
import { GetSeverityBreakdown_ext } from 'wasp/server/operations/queries'
import { GetTrendSeries_ext } from 'wasp/server/operations/queries'
import { GetQuotaStatus_ext } from 'wasp/server/operations/queries'
import { ListScanSavedViews_ext } from 'wasp/server/operations/queries'
import { GetReport_ext } from 'wasp/server/operations/queries'
import { GetReportSummary_ext } from 'wasp/server/operations/queries'
import { GetCIDecision_ext } from 'wasp/server/operations/queries'
import { ListFindingAnnotations_ext } from 'wasp/server/operations/queries'
import { ListWebhooks_ext } from 'wasp/server/operations/queries'
import { GetWebhook_ext } from 'wasp/server/operations/queries'
import { ListWebhookDeliveries_ext } from 'wasp/server/operations/queries'
import { GetCustomerPortalUrl_ext } from 'wasp/server/operations/queries'
import { GetWorkspaceContext_ext } from 'wasp/server/operations/queries'
import { ListWorkspaces_ext } from 'wasp/server/operations/queries'
import { GetProfileSettings_ext } from 'wasp/server/operations/queries'
import { GetOnboardingState_ext } from 'wasp/server/operations/queries'
import { ListGithubInstallations_ext } from 'wasp/server/operations/queries'
import { GetGithubAppSetup_ext } from 'wasp/server/operations/queries'
import { GetNotificationSettings_ext } from 'wasp/server/operations/queries'
import { GetScannerAccessSettings_ext } from 'wasp/server/operations/queries'

// PUBLIC API
export const getPaginatedUsers: QueryFor<GetPaginatedUsers_ext> = createQuery<GetPaginatedUsers_ext>(
  'operations/get-paginated-users',
  ['User'],
)

// PUBLIC API
export const listApiKeys: QueryFor<ListApiKeys_ext> = createQuery<ListApiKeys_ext>(
  'operations/list-api-keys',
  ['User', 'ApiKey'],
)

// PUBLIC API
export const getAPIKeyDetails: QueryFor<GetAPIKeyDetails_ext> = createQuery<GetAPIKeyDetails_ext>(
  'operations/get-apikey-details',
  ['User', 'ApiKey'],
)

// PUBLIC API
export const getScans: QueryFor<GetScans_ext> = createQuery<GetScans_ext>(
  'operations/get-scans',
  ['User', 'Scan'],
)

// PUBLIC API
export const getScanById: QueryFor<GetScanById_ext> = createQuery<GetScanById_ext>(
  'operations/get-scan-by-id',
  ['User', 'Scan'],
)

// PUBLIC API
export const getDashboardMetrics: QueryFor<GetDashboardMetrics_ext> = createQuery<GetDashboardMetrics_ext>(
  'operations/get-dashboard-metrics',
  ['User', 'Scan', 'Finding'],
)

// PUBLIC API
export const getRecentScans: QueryFor<GetRecentScans_ext> = createQuery<GetRecentScans_ext>(
  'operations/get-recent-scans',
  ['User', 'Scan', 'ScanResult'],
)

// PUBLIC API
export const getSeverityBreakdown: QueryFor<GetSeverityBreakdown_ext> = createQuery<GetSeverityBreakdown_ext>(
  'operations/get-severity-breakdown',
  ['User', 'Finding'],
)

// PUBLIC API
export const getTrendSeries: QueryFor<GetTrendSeries_ext> = createQuery<GetTrendSeries_ext>(
  'operations/get-trend-series',
  ['User', 'Scan', 'Finding', 'ScanDelta'],
)

// PUBLIC API
export const getQuotaStatus: QueryFor<GetQuotaStatus_ext> = createQuery<GetQuotaStatus_ext>(
  'operations/get-quota-status',
  ['User', 'Scan'],
)

// PUBLIC API
export const listScanSavedViews: QueryFor<ListScanSavedViews_ext> = createQuery<ListScanSavedViews_ext>(
  'operations/list-scan-saved-views',
  ['User'],
)

// PUBLIC API
export const getReport: QueryFor<GetReport_ext> = createQuery<GetReport_ext>(
  'operations/get-report',
  ['User', 'Scan', 'Finding', 'VulnAcceptance'],
)

// PUBLIC API
export const getReportSummary: QueryFor<GetReportSummary_ext> = createQuery<GetReportSummary_ext>(
  'operations/get-report-summary',
  ['User', 'Scan', 'Finding'],
)

// PUBLIC API
export const getCIDecision: QueryFor<GetCIDecision_ext> = createQuery<GetCIDecision_ext>(
  'operations/get-cidecision',
  ['User', 'Scan', 'Finding'],
)

// PUBLIC API
export const listFindingAnnotations: QueryFor<ListFindingAnnotations_ext> = createQuery<ListFindingAnnotations_ext>(
  'operations/list-finding-annotations',
  ['User', 'Scan', 'Finding', 'VulnAcceptance'],
)

// PUBLIC API
export const listWebhooks: QueryFor<ListWebhooks_ext> = createQuery<ListWebhooks_ext>(
  'operations/list-webhooks',
  ['User', 'Webhook'],
)

// PUBLIC API
export const getWebhook: QueryFor<GetWebhook_ext> = createQuery<GetWebhook_ext>(
  'operations/get-webhook',
  ['User', 'Webhook', 'WebhookDelivery'],
)

// PUBLIC API
export const listWebhookDeliveries: QueryFor<ListWebhookDeliveries_ext> = createQuery<ListWebhookDeliveries_ext>(
  'operations/list-webhook-deliveries',
  ['User', 'Webhook', 'WebhookDelivery'],
)

// PUBLIC API
export const getCustomerPortalUrl: QueryFor<GetCustomerPortalUrl_ext> = createQuery<GetCustomerPortalUrl_ext>(
  'operations/get-customer-portal-url',
  ['User'],
)

// PUBLIC API
export const getWorkspaceContext: QueryFor<GetWorkspaceContext_ext> = createQuery<GetWorkspaceContext_ext>(
  'operations/get-workspace-context',
  ['User', 'Workspace', 'WorkspaceMembership', 'Organization', 'Team'],
)

// PUBLIC API
export const listWorkspaces: QueryFor<ListWorkspaces_ext> = createQuery<ListWorkspaces_ext>(
  'operations/list-workspaces',
  ['User', 'Workspace', 'WorkspaceMembership', 'Organization', 'Team'],
)

// PUBLIC API
export const getProfileSettings: QueryFor<GetProfileSettings_ext> = createQuery<GetProfileSettings_ext>(
  'operations/get-profile-settings',
  ['User', 'Organization'],
)

// PUBLIC API
export const getOnboardingState: QueryFor<GetOnboardingState_ext> = createQuery<GetOnboardingState_ext>(
  'operations/get-onboarding-state',
  ['User', 'Scan', 'GithubInstallation', 'Workspace', 'WorkspaceMembership', 'Organization'],
)

// PUBLIC API
export const listGithubInstallations: QueryFor<ListGithubInstallations_ext> = createQuery<ListGithubInstallations_ext>(
  'operations/list-github-installations',
  ['User', 'GithubInstallation', 'Workspace', 'Organization'],
)

// PUBLIC API
export const getGithubAppSetup: QueryFor<GetGithubAppSetup_ext> = createQuery<GetGithubAppSetup_ext>(
  'operations/get-github-app-setup',
  ['User'],
)

// PUBLIC API
export const getNotificationSettings: QueryFor<GetNotificationSettings_ext> = createQuery<GetNotificationSettings_ext>(
  'operations/get-notification-settings',
  ['User'],
)

// PUBLIC API
export const getScannerAccessSettings: QueryFor<GetScannerAccessSettings_ext> = createQuery<GetScannerAccessSettings_ext>(
  'operations/get-scanner-access-settings',
  ['User'],
)

// PRIVATE API (used in SDK)
export { buildAndRegisterQuery } from './core'
