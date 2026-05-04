
import { prisma } from 'wasp/server'
import {
  type UnauthenticatedOperationFor,
  createUnauthenticatedOperation,
  type AuthenticatedOperationFor,
  createAuthenticatedOperation,
} from '../wrappers.js'
import { getPaginatedUsers as getPaginatedUsers_ext } from 'wasp/src/user/operations'
import { listApiKeys as listApiKeys_ext } from 'wasp/src/apiKeys/operations'
import { getAPIKeyDetails as getAPIKeyDetails_ext } from 'wasp/src/server/operations/apiKeyOperations'
import { getScans as getScans_ext } from 'wasp/src/scans/operations'
import { getScanById as getScanById_ext } from 'wasp/src/scans/operations'
import { getDashboardMetrics as getDashboardMetrics_ext } from 'wasp/src/server/operations/dashboardOperations'
import { getRecentScans as getRecentScans_ext } from 'wasp/src/server/operations/dashboardOperations'
import { getSeverityBreakdown as getSeverityBreakdown_ext } from 'wasp/src/server/operations/dashboardOperations'
import { getTrendSeries as getTrendSeries_ext } from 'wasp/src/server/operations/dashboardOperations'
import { getQuotaStatus as getQuotaStatus_ext } from 'wasp/src/server/operations/dashboardOperations'
import { listScanSavedViews as listScanSavedViews_ext } from 'wasp/src/server/operations/dashboardOperations'
import { getReport as getReport_ext } from 'wasp/src/server/operations/reportOperations'
import { getReportSummary as getReportSummary_ext } from 'wasp/src/server/operations/reportOperations'
import { getCIDecision as getCIDecision_ext } from 'wasp/src/server/operations/reportOperations'
import { listFindingAnnotations as listFindingAnnotations_ext } from 'wasp/src/server/operations/reportOperations'
import { listWebhooks as listWebhooks_ext } from 'wasp/src/server/operations/webhookOperations'
import { getWebhook as getWebhook_ext } from 'wasp/src/server/operations/webhookOperations'
import { listWebhookDeliveries as listWebhookDeliveries_ext } from 'wasp/src/server/operations/webhookOperations'
import { getCustomerPortalUrl as getCustomerPortalUrl_ext } from 'wasp/src/payment/operations'
import { getWorkspaceContext as getWorkspaceContext_ext } from 'wasp/src/server/operations/workspaceOperations'
import { listWorkspaces as listWorkspaces_ext } from 'wasp/src/server/operations/workspaceOperations'
import { getProfileSettings as getProfileSettings_ext } from 'wasp/src/server/operations/settingsOperations'
import { getOnboardingState as getOnboardingState_ext } from 'wasp/src/server/operations/settingsOperations'
import { listGithubInstallations as listGithubInstallations_ext } from 'wasp/src/server/operations/githubOperations'
import { getGithubAppSetup as getGithubAppSetup_ext } from 'wasp/src/server/operations/githubOperations'
import { getNotificationSettings as getNotificationSettings_ext } from 'wasp/src/server/operations/settingsOperations'
import { getScannerAccessSettings as getScannerAccessSettings_ext } from 'wasp/src/server/operations/settingsOperations'

// PRIVATE API
export type GetPaginatedUsers_ext = typeof getPaginatedUsers_ext

// PUBLIC API
export const getPaginatedUsers: AuthenticatedOperationFor<GetPaginatedUsers_ext> =
  createAuthenticatedOperation(
    getPaginatedUsers_ext,
    {
      User: prisma.user,
    },
  )


// PRIVATE API
export type ListApiKeys_ext = typeof listApiKeys_ext

// PUBLIC API
export const listApiKeys: AuthenticatedOperationFor<ListApiKeys_ext> =
  createAuthenticatedOperation(
    listApiKeys_ext,
    {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  )


// PRIVATE API
export type GetAPIKeyDetails_ext = typeof getAPIKeyDetails_ext

// PUBLIC API
export const getAPIKeyDetails: AuthenticatedOperationFor<GetAPIKeyDetails_ext> =
  createAuthenticatedOperation(
    getAPIKeyDetails_ext,
    {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  )


// PRIVATE API
export type GetScans_ext = typeof getScans_ext

// PUBLIC API
export const getScans: AuthenticatedOperationFor<GetScans_ext> =
  createAuthenticatedOperation(
    getScans_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
    },
  )


// PRIVATE API
export type GetScanById_ext = typeof getScanById_ext

// PUBLIC API
export const getScanById: AuthenticatedOperationFor<GetScanById_ext> =
  createAuthenticatedOperation(
    getScanById_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
    },
  )


// PRIVATE API
export type GetDashboardMetrics_ext = typeof getDashboardMetrics_ext

// PUBLIC API
export const getDashboardMetrics: AuthenticatedOperationFor<GetDashboardMetrics_ext> =
  createAuthenticatedOperation(
    getDashboardMetrics_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
    },
  )


// PRIVATE API
export type GetRecentScans_ext = typeof getRecentScans_ext

// PUBLIC API
export const getRecentScans: AuthenticatedOperationFor<GetRecentScans_ext> =
  createAuthenticatedOperation(
    getRecentScans_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      ScanResult: prisma.scanResult,
    },
  )


// PRIVATE API
export type GetSeverityBreakdown_ext = typeof getSeverityBreakdown_ext

// PUBLIC API
export const getSeverityBreakdown: AuthenticatedOperationFor<GetSeverityBreakdown_ext> =
  createAuthenticatedOperation(
    getSeverityBreakdown_ext,
    {
      User: prisma.user,
      Finding: prisma.finding,
    },
  )


// PRIVATE API
export type GetTrendSeries_ext = typeof getTrendSeries_ext

// PUBLIC API
export const getTrendSeries: AuthenticatedOperationFor<GetTrendSeries_ext> =
  createAuthenticatedOperation(
    getTrendSeries_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      ScanDelta: prisma.scanDelta,
    },
  )


// PRIVATE API
export type GetQuotaStatus_ext = typeof getQuotaStatus_ext

// PUBLIC API
export const getQuotaStatus: AuthenticatedOperationFor<GetQuotaStatus_ext> =
  createAuthenticatedOperation(
    getQuotaStatus_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
    },
  )


// PRIVATE API
export type ListScanSavedViews_ext = typeof listScanSavedViews_ext

// PUBLIC API
export const listScanSavedViews: AuthenticatedOperationFor<ListScanSavedViews_ext> =
  createAuthenticatedOperation(
    listScanSavedViews_ext,
    {
      User: prisma.user,
    },
  )


// PRIVATE API
export type GetReport_ext = typeof getReport_ext

// PUBLIC API
export const getReport: AuthenticatedOperationFor<GetReport_ext> =
  createAuthenticatedOperation(
    getReport_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      VulnAcceptance: prisma.vulnAcceptance,
    },
  )


// PRIVATE API
export type GetReportSummary_ext = typeof getReportSummary_ext

// PUBLIC API
export const getReportSummary: AuthenticatedOperationFor<GetReportSummary_ext> =
  createAuthenticatedOperation(
    getReportSummary_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
    },
  )


// PRIVATE API
export type GetCIDecision_ext = typeof getCIDecision_ext

// PUBLIC API
export const getCIDecision: AuthenticatedOperationFor<GetCIDecision_ext> =
  createAuthenticatedOperation(
    getCIDecision_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
    },
  )


// PRIVATE API
export type ListFindingAnnotations_ext = typeof listFindingAnnotations_ext

// PUBLIC API
export const listFindingAnnotations: AuthenticatedOperationFor<ListFindingAnnotations_ext> =
  createAuthenticatedOperation(
    listFindingAnnotations_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      VulnAcceptance: prisma.vulnAcceptance,
    },
  )


// PRIVATE API
export type ListWebhooks_ext = typeof listWebhooks_ext

// PUBLIC API
export const listWebhooks: AuthenticatedOperationFor<ListWebhooks_ext> =
  createAuthenticatedOperation(
    listWebhooks_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
    },
  )


// PRIVATE API
export type GetWebhook_ext = typeof getWebhook_ext

// PUBLIC API
export const getWebhook: AuthenticatedOperationFor<GetWebhook_ext> =
  createAuthenticatedOperation(
    getWebhook_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  )


// PRIVATE API
export type ListWebhookDeliveries_ext = typeof listWebhookDeliveries_ext

// PUBLIC API
export const listWebhookDeliveries: AuthenticatedOperationFor<ListWebhookDeliveries_ext> =
  createAuthenticatedOperation(
    listWebhookDeliveries_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  )


// PRIVATE API
export type GetCustomerPortalUrl_ext = typeof getCustomerPortalUrl_ext

// PUBLIC API
export const getCustomerPortalUrl: AuthenticatedOperationFor<GetCustomerPortalUrl_ext> =
  createAuthenticatedOperation(
    getCustomerPortalUrl_ext,
    {
      User: prisma.user,
    },
  )


// PRIVATE API
export type GetWorkspaceContext_ext = typeof getWorkspaceContext_ext

// PUBLIC API
export const getWorkspaceContext: AuthenticatedOperationFor<GetWorkspaceContext_ext> =
  createAuthenticatedOperation(
    getWorkspaceContext_ext,
    {
      User: prisma.user,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
      Team: prisma.team,
    },
  )


// PRIVATE API
export type ListWorkspaces_ext = typeof listWorkspaces_ext

// PUBLIC API
export const listWorkspaces: AuthenticatedOperationFor<ListWorkspaces_ext> =
  createAuthenticatedOperation(
    listWorkspaces_ext,
    {
      User: prisma.user,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
      Team: prisma.team,
    },
  )


// PRIVATE API
export type GetProfileSettings_ext = typeof getProfileSettings_ext

// PUBLIC API
export const getProfileSettings: AuthenticatedOperationFor<GetProfileSettings_ext> =
  createAuthenticatedOperation(
    getProfileSettings_ext,
    {
      User: prisma.user,
      Organization: prisma.organization,
    },
  )


// PRIVATE API
export type GetOnboardingState_ext = typeof getOnboardingState_ext

// PUBLIC API
export const getOnboardingState: AuthenticatedOperationFor<GetOnboardingState_ext> =
  createAuthenticatedOperation(
    getOnboardingState_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
    },
  )


// PRIVATE API
export type ListGithubInstallations_ext = typeof listGithubInstallations_ext

// PUBLIC API
export const listGithubInstallations: AuthenticatedOperationFor<ListGithubInstallations_ext> =
  createAuthenticatedOperation(
    listGithubInstallations_ext,
    {
      User: prisma.user,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      Organization: prisma.organization,
    },
  )


// PRIVATE API
export type GetGithubAppSetup_ext = typeof getGithubAppSetup_ext

// PUBLIC API
export const getGithubAppSetup: AuthenticatedOperationFor<GetGithubAppSetup_ext> =
  createAuthenticatedOperation(
    getGithubAppSetup_ext,
    {
      User: prisma.user,
    },
  )


// PRIVATE API
export type GetNotificationSettings_ext = typeof getNotificationSettings_ext

// PUBLIC API
export const getNotificationSettings: AuthenticatedOperationFor<GetNotificationSettings_ext> =
  createAuthenticatedOperation(
    getNotificationSettings_ext,
    {
      User: prisma.user,
    },
  )


// PRIVATE API
export type GetScannerAccessSettings_ext = typeof getScannerAccessSettings_ext

// PUBLIC API
export const getScannerAccessSettings: AuthenticatedOperationFor<GetScannerAccessSettings_ext> =
  createAuthenticatedOperation(
    getScannerAccessSettings_ext,
    {
      User: prisma.user,
    },
  )

