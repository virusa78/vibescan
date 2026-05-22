import { type _User, type _ApiKey, type _Scan, type _Finding, type _ScanResult, type _ScanDelta, type _VulnAcceptance, type _Webhook, type _WebhookDelivery, type _Workspace, type _WorkspaceMembership, type _Organization, type _Team, type _GithubInstallation, type AuthenticatedQueryDefinition, type Payload } from 'wasp/server/_types';
export type GetPaginatedUsers<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User
], Input, Output>;
export type ListApiKeys<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _ApiKey
], Input, Output>;
export type GetAPIKeyDetails<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _ApiKey
], Input, Output>;
export type GetScans<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan
], Input, Output>;
export type GetScanById<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan
], Input, Output>;
export type GetDashboardMetrics<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _Finding
], Input, Output>;
export type GetRecentScans<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _ScanResult
], Input, Output>;
export type GetSeverityBreakdown<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Finding
], Input, Output>;
export type GetTrendSeries<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _Finding,
    _ScanDelta
], Input, Output>;
export type GetQuotaStatus<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan
], Input, Output>;
export type ListScanSavedViews<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User
], Input, Output>;
export type GetReport<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _Finding,
    _VulnAcceptance
], Input, Output>;
export type GetReportSummary<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _Finding
], Input, Output>;
export type GetCIDecision<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _Finding
], Input, Output>;
export type ListFindingAnnotations<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _Finding,
    _VulnAcceptance
], Input, Output>;
export type ListWebhooks<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Webhook
], Input, Output>;
export type GetWebhook<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Webhook,
    _WebhookDelivery
], Input, Output>;
export type ListWebhookDeliveries<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Webhook,
    _WebhookDelivery
], Input, Output>;
export type GetCustomerPortalUrl<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User
], Input, Output>;
export type GetWorkspaceContext<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Workspace,
    _WorkspaceMembership,
    _Organization,
    _Team
], Input, Output>;
export type ListWorkspaces<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Workspace,
    _WorkspaceMembership,
    _Organization,
    _Team
], Input, Output>;
export type GetProfileSettings<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Organization
], Input, Output>;
export type GetOnboardingState<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _Scan,
    _GithubInstallation,
    _Workspace,
    _WorkspaceMembership,
    _Organization
], Input, Output>;
export type ListGithubInstallations<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User,
    _GithubInstallation,
    _Workspace,
    _Organization
], Input, Output>;
export type GetGithubAppSetup<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User
], Input, Output>;
export type GetNotificationSettings<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User
], Input, Output>;
export type GetScannerAccessSettings<Input extends Payload = never, Output extends Payload = Payload> = AuthenticatedQueryDefinition<[
    _User
], Input, Output>;
//# sourceMappingURL=types.d.ts.map