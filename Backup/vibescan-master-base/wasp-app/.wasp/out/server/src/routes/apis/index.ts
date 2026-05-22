import express from 'express'
import { prisma } from 'wasp/server'
import { defineHandler } from 'wasp/server/utils'
import { MiddlewareConfigFn, globalMiddlewareConfigForExpress } from '../../middleware/index.js'
import auth from 'wasp/core/auth'
import { type AuthUserData, makeAuthUserIfPossible } from 'wasp/auth/user'


import { emailSignupCompatApi as _waspemailSignupCompatApifn } from '../../../../../../src/server/authCompat'
import { emailLoginCompatApi as _waspemailLoginCompatApifn } from '../../../../../../src/server/authCompat'
import { submitScanApiHandler as _waspsubmitScanApifn } from '../../../../../../src/server/operations/scans/handlers'
import { listScansApiHandler as _wasplistScansApifn } from '../../../../../../src/server/operations/scans/handlers'
import { getScanApiHandler as _waspgetScanApifn } from '../../../../../../src/server/operations/scans/handlers'
import { cancelScanApiHandler as _waspcancelScanApifn } from '../../../../../../src/server/operations/scans/handlers'
import { getScanStatsApiHandler as _waspgetScanStatsApifn } from '../../../../../../src/server/operations/scans/handlers'
import { githubWebhookApiHandler as _waspgithubWebhookApifn } from '../../../../../../src/server/operations/github'
import { paymentsWebhook as _wasppaymentsWebhookfn } from '../../../../../../src/payment/webhook'
import { paymentsMiddlewareConfigFn as _wasppaymentsWebhookmiddlewareConfigFn } from '../../../../../../src/payment/webhook'
import { getBillingAccountApiHandler as _waspgetBillingAccountApifn } from '../../../../../../src/server/operations/billing/handlers'
import { listBillingEventsApiHandler as _wasplistBillingEventsApifn } from '../../../../../../src/server/operations/billing/handlers'
import { getBillingEntitlementsApiHandler as _waspgetBillingEntitlementsApifn } from '../../../../../../src/server/operations/billing/handlers'
import { listEventSubscriptionsApiHandler as _wasplistEventSubscriptionsApifn } from '../../../../../../src/server/operations/events/handlers'
import { createEventSubscriptionApiHandler as _waspcreateEventSubscriptionApifn } from '../../../../../../src/server/operations/events/handlers'
import { listEventDeliveriesApiHandler as _wasplistEventDeliveriesApifn } from '../../../../../../src/server/operations/events/handlers'
import { getEventDeliveryApiHandler as _waspgetEventDeliveryApifn } from '../../../../../../src/server/operations/events/handlers'
import { retryEventDeliveryApiHandler as _waspretryEventDeliveryApifn } from '../../../../../../src/server/operations/events/handlers'
import { generateAPIKeyApiHandler as _waspgenerateAPIKeyApifn } from '../../../../../../src/server/operations/apikeys/handlers'
import { listAPIKeysApiHandler as _wasplistAPIKeysApifn } from '../../../../../../src/server/operations/apikeys/handlers'
import { getAPIKeyDetailsApiHandler as _waspgetAPIKeyDetailsApifn } from '../../../../../../src/server/operations/apikeys/handlers'
import { revokeAPIKeyApiHandler as _wasprevokeAPIKeyApifn } from '../../../../../../src/server/operations/apikeys/handlers'
import { listWorkspacesApiHandler as _wasplistWorkspacesApifn } from '../../../../../../src/server/operations/workspaces'
import { getWorkspaceContextApiHandler as _waspgetWorkspaceContextApifn } from '../../../../../../src/server/operations/workspaces'
import { switchWorkspaceApiHandler as _waspswitchWorkspaceApifn } from '../../../../../../src/server/operations/workspaces'
import { getOnboardingStateApiHandler as _waspgetOnboardingStateApifn } from '../../../../../../src/server/operations/onboarding'
import { completeOnboardingApiHandler as _waspcompleteOnboardingApifn } from '../../../../../../src/server/operations/onboarding'
import { listGithubInstallationsApiHandler as _wasplistGithubInstallationsApifn } from '../../../../../../src/server/operations/github'
import { linkGithubInstallationApiHandler as _wasplinkGithubInstallationApifn } from '../../../../../../src/server/operations/github'
import { updateGithubInstallationSettingsApiHandler as _waspupdateGithubInstallationSettingsApifn } from '../../../../../../src/server/operations/github'
import { getSwaggerJson as _waspswaggerSpecfn } from '../../../../../../src/server/swaggerHandlers'
import { getSwaggerUI as _waspswaggerDocsfn } from '../../../../../../src/server/swaggerHandlers'

const idFn: MiddlewareConfigFn = x => x

const _waspemailSignupCompatApimiddlewareConfigFn = idFn
const _waspemailLoginCompatApimiddlewareConfigFn = idFn
const _waspsubmitScanApimiddlewareConfigFn = idFn
const _wasplistScansApimiddlewareConfigFn = idFn
const _waspgetScanApimiddlewareConfigFn = idFn
const _waspcancelScanApimiddlewareConfigFn = idFn
const _waspgetScanStatsApimiddlewareConfigFn = idFn
const _waspgithubWebhookApimiddlewareConfigFn = idFn
const _waspgetBillingAccountApimiddlewareConfigFn = idFn
const _wasplistBillingEventsApimiddlewareConfigFn = idFn
const _waspgetBillingEntitlementsApimiddlewareConfigFn = idFn
const _wasplistEventSubscriptionsApimiddlewareConfigFn = idFn
const _waspcreateEventSubscriptionApimiddlewareConfigFn = idFn
const _wasplistEventDeliveriesApimiddlewareConfigFn = idFn
const _waspgetEventDeliveryApimiddlewareConfigFn = idFn
const _waspretryEventDeliveryApimiddlewareConfigFn = idFn
const _waspgenerateAPIKeyApimiddlewareConfigFn = idFn
const _wasplistAPIKeysApimiddlewareConfigFn = idFn
const _waspgetAPIKeyDetailsApimiddlewareConfigFn = idFn
const _wasprevokeAPIKeyApimiddlewareConfigFn = idFn
const _wasplistWorkspacesApimiddlewareConfigFn = idFn
const _waspgetWorkspaceContextApimiddlewareConfigFn = idFn
const _waspswitchWorkspaceApimiddlewareConfigFn = idFn
const _waspgetOnboardingStateApimiddlewareConfigFn = idFn
const _waspcompleteOnboardingApimiddlewareConfigFn = idFn
const _wasplistGithubInstallationsApimiddlewareConfigFn = idFn
const _wasplinkGithubInstallationApimiddlewareConfigFn = idFn
const _waspupdateGithubInstallationSettingsApimiddlewareConfigFn = idFn
const _waspswaggerSpecmiddlewareConfigFn = idFn
const _waspswaggerDocsmiddlewareConfigFn = idFn

const router = express.Router()


const emailSignupCompatApiMiddleware = globalMiddlewareConfigForExpress(_waspemailSignupCompatApimiddlewareConfigFn)
router.post(
  '/auth/email/signup',
  [auth, ...emailSignupCompatApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspemailSignupCompatApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspemailSignupCompatApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _waspemailSignupCompatApifn(req, res, context)
    }
  )
)
const emailLoginCompatApiMiddleware = globalMiddlewareConfigForExpress(_waspemailLoginCompatApimiddlewareConfigFn)
router.post(
  '/auth/email/login',
  [auth, ...emailLoginCompatApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspemailLoginCompatApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspemailLoginCompatApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _waspemailLoginCompatApifn(req, res, context)
    }
  )
)
const submitScanApiMiddleware = globalMiddlewareConfigForExpress(_waspsubmitScanApimiddlewareConfigFn)
router.post(
  '/api/v1/scans',
  [auth, ...submitScanApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspsubmitScanApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspsubmitScanApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
          ScanDelta: prisma.scanDelta,
        },
      }
      return _waspsubmitScanApifn(req, res, context)
    }
  )
)
const listScansApiMiddleware = globalMiddlewareConfigForExpress(_wasplistScansApimiddlewareConfigFn)
router.get(
  '/api/v1/scans',
  [auth, ...listScansApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistScansApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistScansApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
        },
      }
      return _wasplistScansApifn(req, res, context)
    }
  )
)
const getScanApiMiddleware = globalMiddlewareConfigForExpress(_waspgetScanApimiddlewareConfigFn)
router.get(
  '/api/v1/scans/:scanId',
  [auth, ...getScanApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetScanApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetScanApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
          ScanResult: prisma.scanResult,
          ScanDelta: prisma.scanDelta,
          Finding: prisma.finding,
        },
      }
      return _waspgetScanApifn(req, res, context)
    }
  )
)
const cancelScanApiMiddleware = globalMiddlewareConfigForExpress(_waspcancelScanApimiddlewareConfigFn)
router.delete(
  '/api/v1/scans/:scanId',
  [auth, ...cancelScanApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspcancelScanApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspcancelScanApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
        },
      }
      return _waspcancelScanApifn(req, res, context)
    }
  )
)
const getScanStatsApiMiddleware = globalMiddlewareConfigForExpress(_waspgetScanStatsApimiddlewareConfigFn)
router.get(
  '/api/v1/scans/stats',
  [auth, ...getScanStatsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetScanStatsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetScanStatsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
          Finding: prisma.finding,
        },
      }
      return _waspgetScanStatsApifn(req, res, context)
    }
  )
)
const githubWebhookApiMiddleware = globalMiddlewareConfigForExpress(_waspgithubWebhookApimiddlewareConfigFn)
router.post(
  '/github/webhook',
  [auth, ...githubWebhookApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgithubWebhookApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgithubWebhookApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
          ScanDelta: prisma.scanDelta,
          GithubInstallation: prisma.githubInstallation,
          Workspace: prisma.workspace,
          Organization: prisma.organization,
        },
      }
      return _waspgithubWebhookApifn(req, res, context)
    }
  )
)
const paymentsWebhookMiddleware = globalMiddlewareConfigForExpress(_wasppaymentsWebhookmiddlewareConfigFn)
router.post(
  '/payments-webhook',
  [auth, ...paymentsWebhookMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasppaymentsWebhookfn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasppaymentsWebhookfn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _wasppaymentsWebhookfn(req, res, context)
    }
  )
)
const getBillingAccountApiMiddleware = globalMiddlewareConfigForExpress(_waspgetBillingAccountApimiddlewareConfigFn)
router.get(
  '/api/v1/billing/account',
  [auth, ...getBillingAccountApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetBillingAccountApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetBillingAccountApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          BillingEventLedger: prisma.billingEventLedger,
        },
      }
      return _waspgetBillingAccountApifn(req, res, context)
    }
  )
)
const listBillingEventsApiMiddleware = globalMiddlewareConfigForExpress(_wasplistBillingEventsApimiddlewareConfigFn)
router.get(
  '/api/v1/billing/events',
  [auth, ...listBillingEventsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistBillingEventsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistBillingEventsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          BillingEventLedger: prisma.billingEventLedger,
        },
      }
      return _wasplistBillingEventsApifn(req, res, context)
    }
  )
)
const getBillingEntitlementsApiMiddleware = globalMiddlewareConfigForExpress(_waspgetBillingEntitlementsApimiddlewareConfigFn)
router.get(
  '/api/v1/billing/entitlements',
  [auth, ...getBillingEntitlementsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetBillingEntitlementsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetBillingEntitlementsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _waspgetBillingEntitlementsApifn(req, res, context)
    }
  )
)
const listEventSubscriptionsApiMiddleware = globalMiddlewareConfigForExpress(_wasplistEventSubscriptionsApimiddlewareConfigFn)
router.get(
  '/api/v1/events/subscriptions',
  [auth, ...listEventSubscriptionsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistEventSubscriptionsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistEventSubscriptionsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          EventSubscription: prisma.eventSubscription,
        },
      }
      return _wasplistEventSubscriptionsApifn(req, res, context)
    }
  )
)
const createEventSubscriptionApiMiddleware = globalMiddlewareConfigForExpress(_waspcreateEventSubscriptionApimiddlewareConfigFn)
router.post(
  '/api/v1/events/subscriptions',
  [auth, ...createEventSubscriptionApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspcreateEventSubscriptionApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspcreateEventSubscriptionApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          EventSubscription: prisma.eventSubscription,
        },
      }
      return _waspcreateEventSubscriptionApifn(req, res, context)
    }
  )
)
const listEventDeliveriesApiMiddleware = globalMiddlewareConfigForExpress(_wasplistEventDeliveriesApimiddlewareConfigFn)
router.get(
  '/api/v1/events/deliveries',
  [auth, ...listEventDeliveriesApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistEventDeliveriesApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistEventDeliveriesApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          EventDelivery: prisma.eventDelivery,
          EventOutbox: prisma.eventOutbox,
          EventSubscription: prisma.eventSubscription,
        },
      }
      return _wasplistEventDeliveriesApifn(req, res, context)
    }
  )
)
const getEventDeliveryApiMiddleware = globalMiddlewareConfigForExpress(_waspgetEventDeliveryApimiddlewareConfigFn)
router.get(
  '/api/v1/events/deliveries/:deliveryId',
  [auth, ...getEventDeliveryApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetEventDeliveryApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetEventDeliveryApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          EventDelivery: prisma.eventDelivery,
          EventOutbox: prisma.eventOutbox,
          EventSubscription: prisma.eventSubscription,
        },
      }
      return _waspgetEventDeliveryApifn(req, res, context)
    }
  )
)
const retryEventDeliveryApiMiddleware = globalMiddlewareConfigForExpress(_waspretryEventDeliveryApimiddlewareConfigFn)
router.post(
  '/api/v1/events/deliveries/:deliveryId/retry',
  [auth, ...retryEventDeliveryApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspretryEventDeliveryApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspretryEventDeliveryApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          EventDelivery: prisma.eventDelivery,
          EventOutbox: prisma.eventOutbox,
          EventSubscription: prisma.eventSubscription,
        },
      }
      return _waspretryEventDeliveryApifn(req, res, context)
    }
  )
)
const generateAPIKeyApiMiddleware = globalMiddlewareConfigForExpress(_waspgenerateAPIKeyApimiddlewareConfigFn)
router.post(
  '/api/v1/api-keys',
  [auth, ...generateAPIKeyApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgenerateAPIKeyApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgenerateAPIKeyApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          ApiKey: prisma.apiKey,
        },
      }
      return _waspgenerateAPIKeyApifn(req, res, context)
    }
  )
)
const listAPIKeysApiMiddleware = globalMiddlewareConfigForExpress(_wasplistAPIKeysApimiddlewareConfigFn)
router.get(
  '/api/v1/api-keys',
  [auth, ...listAPIKeysApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistAPIKeysApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistAPIKeysApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          ApiKey: prisma.apiKey,
        },
      }
      return _wasplistAPIKeysApifn(req, res, context)
    }
  )
)
const getAPIKeyDetailsApiMiddleware = globalMiddlewareConfigForExpress(_waspgetAPIKeyDetailsApimiddlewareConfigFn)
router.get(
  '/api/v1/api-keys/:keyId',
  [auth, ...getAPIKeyDetailsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetAPIKeyDetailsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetAPIKeyDetailsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          ApiKey: prisma.apiKey,
        },
      }
      return _waspgetAPIKeyDetailsApifn(req, res, context)
    }
  )
)
const revokeAPIKeyApiMiddleware = globalMiddlewareConfigForExpress(_wasprevokeAPIKeyApimiddlewareConfigFn)
router.delete(
  '/api/v1/api-keys/:keyId',
  [auth, ...revokeAPIKeyApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasprevokeAPIKeyApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasprevokeAPIKeyApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          ApiKey: prisma.apiKey,
        },
      }
      return _wasprevokeAPIKeyApifn(req, res, context)
    }
  )
)
const listWorkspacesApiMiddleware = globalMiddlewareConfigForExpress(_wasplistWorkspacesApimiddlewareConfigFn)
router.get(
  '/api/v1/workspaces',
  [auth, ...listWorkspacesApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistWorkspacesApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistWorkspacesApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
          Team: prisma.team,
        },
      }
      return _wasplistWorkspacesApifn(req, res, context)
    }
  )
)
const getWorkspaceContextApiMiddleware = globalMiddlewareConfigForExpress(_waspgetWorkspaceContextApimiddlewareConfigFn)
router.get(
  '/api/v1/workspaces/current',
  [auth, ...getWorkspaceContextApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetWorkspaceContextApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetWorkspaceContextApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
          Team: prisma.team,
        },
      }
      return _waspgetWorkspaceContextApifn(req, res, context)
    }
  )
)
const switchWorkspaceApiMiddleware = globalMiddlewareConfigForExpress(_waspswitchWorkspaceApimiddlewareConfigFn)
router.post(
  '/api/v1/workspaces/switch',
  [auth, ...switchWorkspaceApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspswitchWorkspaceApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspswitchWorkspaceApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
          Team: prisma.team,
        },
      }
      return _waspswitchWorkspaceApifn(req, res, context)
    }
  )
)
const getOnboardingStateApiMiddleware = globalMiddlewareConfigForExpress(_waspgetOnboardingStateApimiddlewareConfigFn)
router.get(
  '/api/v1/onboarding/state',
  [auth, ...getOnboardingStateApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspgetOnboardingStateApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspgetOnboardingStateApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          Scan: prisma.scan,
          GithubInstallation: prisma.githubInstallation,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
        },
      }
      return _waspgetOnboardingStateApifn(req, res, context)
    }
  )
)
const completeOnboardingApiMiddleware = globalMiddlewareConfigForExpress(_waspcompleteOnboardingApimiddlewareConfigFn)
router.post(
  '/api/v1/onboarding/complete',
  [auth, ...completeOnboardingApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspcompleteOnboardingApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspcompleteOnboardingApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _waspcompleteOnboardingApifn(req, res, context)
    }
  )
)
const listGithubInstallationsApiMiddleware = globalMiddlewareConfigForExpress(_wasplistGithubInstallationsApimiddlewareConfigFn)
router.get(
  '/api/v1/github/installations',
  [auth, ...listGithubInstallationsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplistGithubInstallationsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplistGithubInstallationsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          GithubInstallation: prisma.githubInstallation,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
        },
      }
      return _wasplistGithubInstallationsApifn(req, res, context)
    }
  )
)
const linkGithubInstallationApiMiddleware = globalMiddlewareConfigForExpress(_wasplinkGithubInstallationApimiddlewareConfigFn)
router.post(
  '/api/v1/github/installations/link',
  [auth, ...linkGithubInstallationApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _wasplinkGithubInstallationApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _wasplinkGithubInstallationApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          GithubInstallation: prisma.githubInstallation,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
        },
      }
      return _wasplinkGithubInstallationApifn(req, res, context)
    }
  )
)
const updateGithubInstallationSettingsApiMiddleware = globalMiddlewareConfigForExpress(_waspupdateGithubInstallationSettingsApimiddlewareConfigFn)
router.post(
  '/api/v1/github/installations/:installationId/settings',
  [auth, ...updateGithubInstallationSettingsApiMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspupdateGithubInstallationSettingsApifn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspupdateGithubInstallationSettingsApifn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
          GithubInstallation: prisma.githubInstallation,
          Workspace: prisma.workspace,
          WorkspaceMembership: prisma.workspaceMembership,
          Organization: prisma.organization,
        },
      }
      return _waspupdateGithubInstallationSettingsApifn(req, res, context)
    }
  )
)
const swaggerSpecMiddleware = globalMiddlewareConfigForExpress(_waspswaggerSpecmiddlewareConfigFn)
router.get(
  '/docs/swagger.json',
  [auth, ...swaggerSpecMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspswaggerSpecfn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspswaggerSpecfn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _waspswaggerSpecfn(req, res, context)
    }
  )
)
const swaggerDocsMiddleware = globalMiddlewareConfigForExpress(_waspswaggerDocsmiddlewareConfigFn)
router.get(
  '/docs',
  [auth, ...swaggerDocsMiddleware],
  defineHandler(
    (
      req: Parameters<typeof _waspswaggerDocsfn>[0] & { user: AuthUserData | null },
      res: Parameters<typeof _waspswaggerDocsfn>[1],
    ) => {
      const context = {
        user: makeAuthUserIfPossible(req.user),
        entities: {
          User: prisma.user,
        },
      }
      return _waspswaggerDocsfn(req, res, context)
    }
  )
)

export default router
