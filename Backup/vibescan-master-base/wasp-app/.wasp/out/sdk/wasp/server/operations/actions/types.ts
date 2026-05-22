import {
  type _User,
  type _ApiKey,
  type _Scan,
  type _Finding,
  type _FindingHistory,
  type _ScanDelta,
  type _AiFixPrompt,
  type _RemediationPromptUsage,
  type _RegionPolicy,
  type _UserPolicyOverride,
  type _VulnAcceptance,
  type _Webhook,
  type _WebhookDelivery,
  type _Workspace,
  type _WorkspaceMembership,
  type _Organization,
  type _Team,
  type _GithubInstallation,
  type UnauthenticatedActionDefinition,
  type AuthenticatedActionDefinition,
  type Payload,
} from 'wasp/server/_types'

// PUBLIC API
export type UpdateIsUserAdminById<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateUserSettings<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type RefreshToken<Input extends Payload = never, Output extends Payload = Payload> = 
  UnauthenticatedActionDefinition<
    [
    ],
    Input,
    Output
  >

// PUBLIC API
export type GenerateApiKey<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _ApiKey,
    ],
    Input,
    Output
  >

// PUBLIC API
export type RevokeApiKey<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _ApiKey,
    ],
    Input,
    Output
  >

// PUBLIC API
export type SubmitScan<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
      _Finding,
      _FindingHistory,
      _ScanDelta,
    ],
    Input,
    Output
  >

// PUBLIC API
export type GenerateCveRemediation<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
      _Finding,
      _AiFixPrompt,
      _RemediationPromptUsage,
      _RegionPolicy,
      _UserPolicyOverride,
    ],
    Input,
    Output
  >

// PUBLIC API
export type CreateScanSavedView<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateScanSavedView<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type DeleteScanSavedView<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type BulkCancelScans<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
      _ScanDelta,
    ],
    Input,
    Output
  >

// PUBLIC API
export type BulkRerunScans<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
      _ScanDelta,
    ],
    Input,
    Output
  >

// PUBLIC API
export type ExportScans<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
    ],
    Input,
    Output
  >

// PUBLIC API
export type GenerateReportPDF<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpsertFindingAnnotation<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Scan,
      _Finding,
      _VulnAcceptance,
    ],
    Input,
    Output
  >

// PUBLIC API
export type CreateWebhook<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Webhook,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateWebhook<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Webhook,
      _WebhookDelivery,
    ],
    Input,
    Output
  >

// PUBLIC API
export type DeleteWebhook<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Webhook,
      _WebhookDelivery,
    ],
    Input,
    Output
  >

// PUBLIC API
export type TestWebhookDelivery<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Webhook,
      _WebhookDelivery,
      _Scan,
      _ScanDelta,
    ],
    Input,
    Output
  >

// PUBLIC API
export type RetryWebhookDelivery<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Webhook,
      _WebhookDelivery,
    ],
    Input,
    Output
  >

// PUBLIC API
export type GenerateCheckoutSession<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type SwitchWorkspace<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Workspace,
      _WorkspaceMembership,
      _Organization,
      _Team,
    ],
    Input,
    Output
  >

// PUBLIC API
export type CompleteOnboarding<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type LinkGithubInstallation<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _GithubInstallation,
      _Workspace,
      _WorkspaceMembership,
      _Organization,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateGithubInstallationSettings<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _GithubInstallation,
      _Workspace,
      _WorkspaceMembership,
      _Organization,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateProfileSettings<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
      _Organization,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateNotificationSettings<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

// PUBLIC API
export type UpdateScannerAccessSettings<Input extends Payload = never, Output extends Payload = Payload> = 
  AuthenticatedActionDefinition<
    [
      _User,
    ],
    Input,
    Output
  >

