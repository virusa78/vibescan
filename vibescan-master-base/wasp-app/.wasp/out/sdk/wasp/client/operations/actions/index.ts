import { type ActionFor, createAction } from './core'
import { UpdateIsUserAdminById_ext } from 'wasp/server/operations/actions'
import { UpdateUserSettings_ext } from 'wasp/server/operations/actions'
import { RefreshToken_ext } from 'wasp/server/operations/actions'
import { GenerateApiKey_ext } from 'wasp/server/operations/actions'
import { RevokeApiKey_ext } from 'wasp/server/operations/actions'
import { SubmitScan_ext } from 'wasp/server/operations/actions'
import { GenerateCveRemediation_ext } from 'wasp/server/operations/actions'
import { CreateScanSavedView_ext } from 'wasp/server/operations/actions'
import { UpdateScanSavedView_ext } from 'wasp/server/operations/actions'
import { DeleteScanSavedView_ext } from 'wasp/server/operations/actions'
import { BulkCancelScans_ext } from 'wasp/server/operations/actions'
import { BulkRerunScans_ext } from 'wasp/server/operations/actions'
import { ExportScans_ext } from 'wasp/server/operations/actions'
import { GenerateReportPDF_ext } from 'wasp/server/operations/actions'
import { UpsertFindingAnnotation_ext } from 'wasp/server/operations/actions'
import { CreateWebhook_ext } from 'wasp/server/operations/actions'
import { UpdateWebhook_ext } from 'wasp/server/operations/actions'
import { DeleteWebhook_ext } from 'wasp/server/operations/actions'
import { TestWebhookDelivery_ext } from 'wasp/server/operations/actions'
import { RetryWebhookDelivery_ext } from 'wasp/server/operations/actions'
import { GenerateCheckoutSession_ext } from 'wasp/server/operations/actions'
import { SwitchWorkspace_ext } from 'wasp/server/operations/actions'
import { CompleteOnboarding_ext } from 'wasp/server/operations/actions'
import { LinkGithubInstallation_ext } from 'wasp/server/operations/actions'
import { UpdateGithubInstallationSettings_ext } from 'wasp/server/operations/actions'
import { UpdateProfileSettings_ext } from 'wasp/server/operations/actions'
import { UpdateNotificationSettings_ext } from 'wasp/server/operations/actions'
import { UpdateScannerAccessSettings_ext } from 'wasp/server/operations/actions'

// PUBLIC API
export const updateIsUserAdminById: ActionFor<UpdateIsUserAdminById_ext> = createAction<UpdateIsUserAdminById_ext>(
  'operations/update-is-user-admin-by-id',
  ['User'],
)

// PUBLIC API
export const updateUserSettings: ActionFor<UpdateUserSettings_ext> = createAction<UpdateUserSettings_ext>(
  'operations/update-user-settings',
  ['User'],
)

// PUBLIC API
export const refreshToken: ActionFor<RefreshToken_ext> = createAction<RefreshToken_ext>(
  'operations/refresh-token',
  [],
)

// PUBLIC API
export const generateApiKey: ActionFor<GenerateApiKey_ext> = createAction<GenerateApiKey_ext>(
  'operations/generate-api-key',
  ['User', 'ApiKey'],
)

// PUBLIC API
export const revokeApiKey: ActionFor<RevokeApiKey_ext> = createAction<RevokeApiKey_ext>(
  'operations/revoke-api-key',
  ['User', 'ApiKey'],
)

// PUBLIC API
export const submitScan: ActionFor<SubmitScan_ext> = createAction<SubmitScan_ext>(
  'operations/submit-scan',
  ['User', 'Scan', 'Finding', 'FindingHistory', 'ScanDelta'],
)

// PUBLIC API
export const generateCveRemediation: ActionFor<GenerateCveRemediation_ext> = createAction<GenerateCveRemediation_ext>(
  'operations/generate-cve-remediation',
  ['User', 'Scan', 'Finding', 'AiFixPrompt', 'RemediationPromptUsage', 'RegionPolicy', 'UserPolicyOverride'],
)

// PUBLIC API
export const createScanSavedView: ActionFor<CreateScanSavedView_ext> = createAction<CreateScanSavedView_ext>(
  'operations/create-scan-saved-view',
  ['User'],
)

// PUBLIC API
export const updateScanSavedView: ActionFor<UpdateScanSavedView_ext> = createAction<UpdateScanSavedView_ext>(
  'operations/update-scan-saved-view',
  ['User'],
)

// PUBLIC API
export const deleteScanSavedView: ActionFor<DeleteScanSavedView_ext> = createAction<DeleteScanSavedView_ext>(
  'operations/delete-scan-saved-view',
  ['User'],
)

// PUBLIC API
export const bulkCancelScans: ActionFor<BulkCancelScans_ext> = createAction<BulkCancelScans_ext>(
  'operations/bulk-cancel-scans',
  ['User', 'Scan', 'ScanDelta'],
)

// PUBLIC API
export const bulkRerunScans: ActionFor<BulkRerunScans_ext> = createAction<BulkRerunScans_ext>(
  'operations/bulk-rerun-scans',
  ['User', 'Scan', 'ScanDelta'],
)

// PUBLIC API
export const exportScans: ActionFor<ExportScans_ext> = createAction<ExportScans_ext>(
  'operations/export-scans',
  ['User', 'Scan'],
)

// PUBLIC API
export const generateReportPDF: ActionFor<GenerateReportPDF_ext> = createAction<GenerateReportPDF_ext>(
  'operations/generate-report-pdf',
  ['User', 'Scan'],
)

// PUBLIC API
export const upsertFindingAnnotation: ActionFor<UpsertFindingAnnotation_ext> = createAction<UpsertFindingAnnotation_ext>(
  'operations/upsert-finding-annotation',
  ['User', 'Scan', 'Finding', 'VulnAcceptance'],
)

// PUBLIC API
export const createWebhook: ActionFor<CreateWebhook_ext> = createAction<CreateWebhook_ext>(
  'operations/create-webhook',
  ['User', 'Webhook'],
)

// PUBLIC API
export const updateWebhook: ActionFor<UpdateWebhook_ext> = createAction<UpdateWebhook_ext>(
  'operations/update-webhook',
  ['User', 'Webhook', 'WebhookDelivery'],
)

// PUBLIC API
export const deleteWebhook: ActionFor<DeleteWebhook_ext> = createAction<DeleteWebhook_ext>(
  'operations/delete-webhook',
  ['User', 'Webhook', 'WebhookDelivery'],
)

// PUBLIC API
export const testWebhookDelivery: ActionFor<TestWebhookDelivery_ext> = createAction<TestWebhookDelivery_ext>(
  'operations/test-webhook-delivery',
  ['User', 'Webhook', 'WebhookDelivery', 'Scan', 'ScanDelta'],
)

// PUBLIC API
export const retryWebhookDelivery: ActionFor<RetryWebhookDelivery_ext> = createAction<RetryWebhookDelivery_ext>(
  'operations/retry-webhook-delivery',
  ['User', 'Webhook', 'WebhookDelivery'],
)

// PUBLIC API
export const generateCheckoutSession: ActionFor<GenerateCheckoutSession_ext> = createAction<GenerateCheckoutSession_ext>(
  'operations/generate-checkout-session',
  ['User'],
)

// PUBLIC API
export const switchWorkspace: ActionFor<SwitchWorkspace_ext> = createAction<SwitchWorkspace_ext>(
  'operations/switch-workspace',
  ['User', 'Workspace', 'WorkspaceMembership', 'Organization', 'Team'],
)

// PUBLIC API
export const completeOnboarding: ActionFor<CompleteOnboarding_ext> = createAction<CompleteOnboarding_ext>(
  'operations/complete-onboarding',
  ['User'],
)

// PUBLIC API
export const linkGithubInstallation: ActionFor<LinkGithubInstallation_ext> = createAction<LinkGithubInstallation_ext>(
  'operations/link-github-installation',
  ['User', 'GithubInstallation', 'Workspace', 'WorkspaceMembership', 'Organization'],
)

// PUBLIC API
export const updateGithubInstallationSettings: ActionFor<UpdateGithubInstallationSettings_ext> = createAction<UpdateGithubInstallationSettings_ext>(
  'operations/update-github-installation-settings',
  ['User', 'GithubInstallation', 'Workspace', 'WorkspaceMembership', 'Organization'],
)

// PUBLIC API
export const updateProfileSettings: ActionFor<UpdateProfileSettings_ext> = createAction<UpdateProfileSettings_ext>(
  'operations/update-profile-settings',
  ['User', 'Organization'],
)

// PUBLIC API
export const updateNotificationSettings: ActionFor<UpdateNotificationSettings_ext> = createAction<UpdateNotificationSettings_ext>(
  'operations/update-notification-settings',
  ['User'],
)

// PUBLIC API
export const updateScannerAccessSettings: ActionFor<UpdateScannerAccessSettings_ext> = createAction<UpdateScannerAccessSettings_ext>(
  'operations/update-scanner-access-settings',
  ['User'],
)
