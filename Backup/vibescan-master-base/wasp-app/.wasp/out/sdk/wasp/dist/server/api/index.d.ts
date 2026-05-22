import { type ParamsDictionary as ExpressParams, type Query as ExpressQuery } from 'express-serve-static-core';
import { type _User, type _Scan, type _ScanDelta, type _ScanResult, type _Finding, type _GithubInstallation, type _Workspace, type _Organization, type _BillingEventLedger, type _EventSubscription, type _EventDelivery, type _EventOutbox, type _ApiKey, type _WorkspaceMembership, type _Team, type AuthenticatedApi } from '../_types';
export type EmailSignupCompatApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type EmailLoginCompatApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type SubmitScanApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan,
    _ScanDelta
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListScansApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetScanApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan,
    _ScanResult,
    _ScanDelta,
    _Finding
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type CancelScanApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetScanStatsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan,
    _Finding
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GithubWebhookApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan,
    _ScanDelta,
    _GithubInstallation,
    _Workspace,
    _Organization
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type PaymentsWebhook<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetBillingAccountApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _BillingEventLedger
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListBillingEventsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _BillingEventLedger
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetBillingEntitlementsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListEventSubscriptionsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _EventSubscription
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type CreateEventSubscriptionApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _EventSubscription
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListEventDeliveriesApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _EventDelivery,
    _EventOutbox,
    _EventSubscription
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetEventDeliveryApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _EventDelivery,
    _EventOutbox,
    _EventSubscription
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type RetryEventDeliveryApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _EventDelivery,
    _EventOutbox,
    _EventSubscription
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GenerateAPIKeyApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _ApiKey
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListAPIKeysApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _ApiKey
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetAPIKeyDetailsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _ApiKey
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type RevokeAPIKeyApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _ApiKey
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListWorkspacesApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Workspace,
    _WorkspaceMembership,
    _Organization,
    _Team
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetWorkspaceContextApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Workspace,
    _WorkspaceMembership,
    _Organization,
    _Team
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type SwitchWorkspaceApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Workspace,
    _WorkspaceMembership,
    _Organization,
    _Team
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type GetOnboardingStateApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _Scan,
    _GithubInstallation,
    _Workspace,
    _WorkspaceMembership,
    _Organization
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type CompleteOnboardingApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type ListGithubInstallationsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _GithubInstallation,
    _Workspace,
    _WorkspaceMembership,
    _Organization
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type LinkGithubInstallationApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _GithubInstallation,
    _Workspace,
    _WorkspaceMembership,
    _Organization
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type UpdateGithubInstallationSettingsApi<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User,
    _GithubInstallation,
    _Workspace,
    _WorkspaceMembership,
    _Organization
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type SwaggerSpec<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
export type SwaggerDocs<P extends ExpressParams = ExpressParams, ResBody = any, ReqBody = any, ReqQuery extends ExpressQuery = ExpressQuery, Locals extends Record<string, any> = Record<string, any>> = AuthenticatedApi<[
    _User
], P, ResBody, ReqBody, ReqQuery, Locals>;
//# sourceMappingURL=index.d.ts.map