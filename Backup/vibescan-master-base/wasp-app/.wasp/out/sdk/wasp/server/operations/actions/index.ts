
import { prisma } from 'wasp/server'
import {
  type UnauthenticatedOperationFor,
  createUnauthenticatedOperation,
  type AuthenticatedOperationFor,
  createAuthenticatedOperation,
} from '../wrappers.js'
import { updateIsUserAdminById as updateIsUserAdminById_ext } from 'wasp/src/user/operations'
import { updateUserSettings as updateUserSettings_ext } from 'wasp/src/user/operations'
import { refreshToken as refreshToken_ext } from 'wasp/src/server/operations/auth/refreshToken'
import { generateApiKey as generateApiKey_ext } from 'wasp/src/apiKeys/operations'
import { revokeApiKey as revokeApiKey_ext } from 'wasp/src/apiKeys/operations'
import { submitScan as submitScan_ext } from 'wasp/src/scans/operations'
import { generateCveRemediation as generateCveRemediation_ext } from 'wasp/src/server/operations/remediation/generateCveRemediation'
import { createScanSavedView as createScanSavedView_ext } from 'wasp/src/server/operations/dashboardOperations'
import { updateScanSavedView as updateScanSavedView_ext } from 'wasp/src/server/operations/dashboardOperations'
import { deleteScanSavedView as deleteScanSavedView_ext } from 'wasp/src/server/operations/dashboardOperations'
import { bulkCancelScans as bulkCancelScans_ext } from 'wasp/src/server/operations/dashboardOperations'
import { bulkRerunScans as bulkRerunScans_ext } from 'wasp/src/server/operations/dashboardOperations'
import { exportScans as exportScans_ext } from 'wasp/src/server/operations/dashboardOperations'
import { generateReportPDF as generateReportPDF_ext } from 'wasp/src/server/operations/reportOperations'
import { upsertFindingAnnotation as upsertFindingAnnotation_ext } from 'wasp/src/server/operations/reportOperations'
import { createWebhook as createWebhook_ext } from 'wasp/src/server/operations/webhookOperations'
import { updateWebhook as updateWebhook_ext } from 'wasp/src/server/operations/webhookOperations'
import { deleteWebhook as deleteWebhook_ext } from 'wasp/src/server/operations/webhookOperations'
import { testWebhookDelivery as testWebhookDelivery_ext } from 'wasp/src/server/operations/webhookOperations'
import { retryWebhookDelivery as retryWebhookDelivery_ext } from 'wasp/src/server/operations/webhookOperations'
import { generateCheckoutSession as generateCheckoutSession_ext } from 'wasp/src/payment/operations'
import { switchWorkspace as switchWorkspace_ext } from 'wasp/src/server/operations/workspaceOperations'
import { completeOnboarding as completeOnboarding_ext } from 'wasp/src/server/operations/settingsOperations'
import { linkGithubInstallation as linkGithubInstallation_ext } from 'wasp/src/server/operations/githubOperations'
import { updateGithubInstallationSettings as updateGithubInstallationSettings_ext } from 'wasp/src/server/operations/githubOperations'
import { updateProfileSettings as updateProfileSettings_ext } from 'wasp/src/server/operations/settingsOperations'
import { updateNotificationSettings as updateNotificationSettings_ext } from 'wasp/src/server/operations/settingsOperations'
import { updateScannerAccessSettings as updateScannerAccessSettings_ext } from 'wasp/src/server/operations/settingsOperations'

// PRIVATE API
export type UpdateIsUserAdminById_ext = typeof updateIsUserAdminById_ext

// PUBLIC API
export const updateIsUserAdminById: AuthenticatedOperationFor<UpdateIsUserAdminById_ext> =
  createAuthenticatedOperation(
    updateIsUserAdminById_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type UpdateUserSettings_ext = typeof updateUserSettings_ext

// PUBLIC API
export const updateUserSettings: AuthenticatedOperationFor<UpdateUserSettings_ext> =
  createAuthenticatedOperation(
    updateUserSettings_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type RefreshToken_ext = typeof refreshToken_ext

// PUBLIC API
export const refreshToken: UnauthenticatedOperationFor<RefreshToken_ext> =
  createUnauthenticatedOperation(
    refreshToken_ext,
    {
    },
  )

// PRIVATE API
export type GenerateApiKey_ext = typeof generateApiKey_ext

// PUBLIC API
export const generateApiKey: AuthenticatedOperationFor<GenerateApiKey_ext> =
  createAuthenticatedOperation(
    generateApiKey_ext,
    {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  )

// PRIVATE API
export type RevokeApiKey_ext = typeof revokeApiKey_ext

// PUBLIC API
export const revokeApiKey: AuthenticatedOperationFor<RevokeApiKey_ext> =
  createAuthenticatedOperation(
    revokeApiKey_ext,
    {
      User: prisma.user,
      ApiKey: prisma.apiKey,
    },
  )

// PRIVATE API
export type SubmitScan_ext = typeof submitScan_ext

// PUBLIC API
export const submitScan: AuthenticatedOperationFor<SubmitScan_ext> =
  createAuthenticatedOperation(
    submitScan_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      FindingHistory: prisma.findingHistory,
      ScanDelta: prisma.scanDelta,
    },
  )

// PRIVATE API
export type GenerateCveRemediation_ext = typeof generateCveRemediation_ext

// PUBLIC API
export const generateCveRemediation: AuthenticatedOperationFor<GenerateCveRemediation_ext> =
  createAuthenticatedOperation(
    generateCveRemediation_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      AiFixPrompt: prisma.aiFixPrompt,
      RemediationPromptUsage: prisma.remediationPromptUsage,
      RegionPolicy: prisma.regionPolicy,
      UserPolicyOverride: prisma.userPolicyOverride,
    },
  )

// PRIVATE API
export type CreateScanSavedView_ext = typeof createScanSavedView_ext

// PUBLIC API
export const createScanSavedView: AuthenticatedOperationFor<CreateScanSavedView_ext> =
  createAuthenticatedOperation(
    createScanSavedView_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type UpdateScanSavedView_ext = typeof updateScanSavedView_ext

// PUBLIC API
export const updateScanSavedView: AuthenticatedOperationFor<UpdateScanSavedView_ext> =
  createAuthenticatedOperation(
    updateScanSavedView_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type DeleteScanSavedView_ext = typeof deleteScanSavedView_ext

// PUBLIC API
export const deleteScanSavedView: AuthenticatedOperationFor<DeleteScanSavedView_ext> =
  createAuthenticatedOperation(
    deleteScanSavedView_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type BulkCancelScans_ext = typeof bulkCancelScans_ext

// PUBLIC API
export const bulkCancelScans: AuthenticatedOperationFor<BulkCancelScans_ext> =
  createAuthenticatedOperation(
    bulkCancelScans_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      ScanDelta: prisma.scanDelta,
    },
  )

// PRIVATE API
export type BulkRerunScans_ext = typeof bulkRerunScans_ext

// PUBLIC API
export const bulkRerunScans: AuthenticatedOperationFor<BulkRerunScans_ext> =
  createAuthenticatedOperation(
    bulkRerunScans_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      ScanDelta: prisma.scanDelta,
    },
  )

// PRIVATE API
export type ExportScans_ext = typeof exportScans_ext

// PUBLIC API
export const exportScans: AuthenticatedOperationFor<ExportScans_ext> =
  createAuthenticatedOperation(
    exportScans_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
    },
  )

// PRIVATE API
export type GenerateReportPDF_ext = typeof generateReportPDF_ext

// PUBLIC API
export const generateReportPDF: AuthenticatedOperationFor<GenerateReportPDF_ext> =
  createAuthenticatedOperation(
    generateReportPDF_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
    },
  )

// PRIVATE API
export type UpsertFindingAnnotation_ext = typeof upsertFindingAnnotation_ext

// PUBLIC API
export const upsertFindingAnnotation: AuthenticatedOperationFor<UpsertFindingAnnotation_ext> =
  createAuthenticatedOperation(
    upsertFindingAnnotation_ext,
    {
      User: prisma.user,
      Scan: prisma.scan,
      Finding: prisma.finding,
      VulnAcceptance: prisma.vulnAcceptance,
    },
  )

// PRIVATE API
export type CreateWebhook_ext = typeof createWebhook_ext

// PUBLIC API
export const createWebhook: AuthenticatedOperationFor<CreateWebhook_ext> =
  createAuthenticatedOperation(
    createWebhook_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
    },
  )

// PRIVATE API
export type UpdateWebhook_ext = typeof updateWebhook_ext

// PUBLIC API
export const updateWebhook: AuthenticatedOperationFor<UpdateWebhook_ext> =
  createAuthenticatedOperation(
    updateWebhook_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  )

// PRIVATE API
export type DeleteWebhook_ext = typeof deleteWebhook_ext

// PUBLIC API
export const deleteWebhook: AuthenticatedOperationFor<DeleteWebhook_ext> =
  createAuthenticatedOperation(
    deleteWebhook_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  )

// PRIVATE API
export type TestWebhookDelivery_ext = typeof testWebhookDelivery_ext

// PUBLIC API
export const testWebhookDelivery: AuthenticatedOperationFor<TestWebhookDelivery_ext> =
  createAuthenticatedOperation(
    testWebhookDelivery_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
      Scan: prisma.scan,
      ScanDelta: prisma.scanDelta,
    },
  )

// PRIVATE API
export type RetryWebhookDelivery_ext = typeof retryWebhookDelivery_ext

// PUBLIC API
export const retryWebhookDelivery: AuthenticatedOperationFor<RetryWebhookDelivery_ext> =
  createAuthenticatedOperation(
    retryWebhookDelivery_ext,
    {
      User: prisma.user,
      Webhook: prisma.webhook,
      WebhookDelivery: prisma.webhookDelivery,
    },
  )

// PRIVATE API
export type GenerateCheckoutSession_ext = typeof generateCheckoutSession_ext

// PUBLIC API
export const generateCheckoutSession: AuthenticatedOperationFor<GenerateCheckoutSession_ext> =
  createAuthenticatedOperation(
    generateCheckoutSession_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type SwitchWorkspace_ext = typeof switchWorkspace_ext

// PUBLIC API
export const switchWorkspace: AuthenticatedOperationFor<SwitchWorkspace_ext> =
  createAuthenticatedOperation(
    switchWorkspace_ext,
    {
      User: prisma.user,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
      Team: prisma.team,
    },
  )

// PRIVATE API
export type CompleteOnboarding_ext = typeof completeOnboarding_ext

// PUBLIC API
export const completeOnboarding: AuthenticatedOperationFor<CompleteOnboarding_ext> =
  createAuthenticatedOperation(
    completeOnboarding_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type LinkGithubInstallation_ext = typeof linkGithubInstallation_ext

// PUBLIC API
export const linkGithubInstallation: AuthenticatedOperationFor<LinkGithubInstallation_ext> =
  createAuthenticatedOperation(
    linkGithubInstallation_ext,
    {
      User: prisma.user,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
    },
  )

// PRIVATE API
export type UpdateGithubInstallationSettings_ext = typeof updateGithubInstallationSettings_ext

// PUBLIC API
export const updateGithubInstallationSettings: AuthenticatedOperationFor<UpdateGithubInstallationSettings_ext> =
  createAuthenticatedOperation(
    updateGithubInstallationSettings_ext,
    {
      User: prisma.user,
      GithubInstallation: prisma.githubInstallation,
      Workspace: prisma.workspace,
      WorkspaceMembership: prisma.workspaceMembership,
      Organization: prisma.organization,
    },
  )

// PRIVATE API
export type UpdateProfileSettings_ext = typeof updateProfileSettings_ext

// PUBLIC API
export const updateProfileSettings: AuthenticatedOperationFor<UpdateProfileSettings_ext> =
  createAuthenticatedOperation(
    updateProfileSettings_ext,
    {
      User: prisma.user,
      Organization: prisma.organization,
    },
  )

// PRIVATE API
export type UpdateNotificationSettings_ext = typeof updateNotificationSettings_ext

// PUBLIC API
export const updateNotificationSettings: AuthenticatedOperationFor<UpdateNotificationSettings_ext> =
  createAuthenticatedOperation(
    updateNotificationSettings_ext,
    {
      User: prisma.user,
    },
  )

// PRIVATE API
export type UpdateScannerAccessSettings_ext = typeof updateScannerAccessSettings_ext

// PUBLIC API
export const updateScannerAccessSettings: AuthenticatedOperationFor<UpdateScannerAccessSettings_ext> =
  createAuthenticatedOperation(
    updateScannerAccessSettings_ext,
    {
      User: prisma.user,
    },
  )
