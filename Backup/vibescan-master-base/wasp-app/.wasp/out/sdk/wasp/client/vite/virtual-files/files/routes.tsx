import { getRouteObjects } from "wasp/client/app/router";
import { initializeQueryClient } from "wasp/client/operations";
import { lazy } from "react"

import { createAuthRequiredPage } from "wasp/client/app"

import App_ext from './src/client/App'



const routesMapping = {
  LandingPageRoute: {
    Component:
      lazy(() =>
        import('./src/landing-page/LandingPage').then(m => m.default)
        .then(component => ({ default: component }))
      ),
  },
  RootRoute: {
    Component:
      lazy(() =>
        import('./src/dashboard/DashboardPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  DashboardRoute: {
    Component:
      lazy(() =>
        import('./src/dashboard/DashboardPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  OnboardingRoute: {
    Component:
      lazy(() =>
        import('./src/onboarding/OnboardingPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  LoginRoute: {
    Component:
      lazy(() =>
        import('./src/auth/LoginPage').then(m => m.default)
        .then(component => ({ default: component }))
      ),
  },
  SignupRoute: {
    Component:
      lazy(() =>
        import('./src/auth/SignupPage').then(m => m.Signup)
        .then(component => ({ default: component }))
      ),
  },
  RequestPasswordResetRoute: {
    Component:
      lazy(() =>
        import('./src/auth/email-and-pass/RequestPasswordResetPage').then(m => m.RequestPasswordResetPage)
        .then(component => ({ default: component }))
      ),
  },
  PasswordResetRoute: {
    Component:
      lazy(() =>
        import('./src/auth/email-and-pass/PasswordResetPage').then(m => m.PasswordResetPage)
        .then(component => ({ default: component }))
      ),
  },
  EmailVerificationRoute: {
    Component:
      lazy(() =>
        import('./src/auth/email-and-pass/EmailVerificationPage').then(m => m.EmailVerificationPage)
        .then(component => ({ default: component }))
      ),
  },
  AccountRoute: {
    Component:
      lazy(() =>
        import('./src/user/AccountPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  SettingsRoute: {
    Component:
      lazy(() =>
        import('./src/user/SettingsPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  ApiKeysRoute: {
    Component:
      lazy(() =>
        import('./src/apiKeys/ApiKeysPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  ReportsRoute: {
    Component:
      lazy(() =>
        import('./src/reports/ReportsPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  ScanDetailsRoute: {
    Component:
      lazy(() =>
        import('./src/dashboard/ScanDetailsPage').then(m => m.ScanDetailsPage)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  WebhooksRoute: {
    Component:
      lazy(() =>
        import('./src/webhooks/WebhooksPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  NewScanRoute: {
    Component:
      lazy(() =>
        import('./src/scans/NewScanPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  PricingPageRoute: {
    Component:
      lazy(() =>
        import('./src/payment/PricingPage').then(m => m.default)
        .then(component => ({ default: component }))
      ),
  },
  CheckoutResultRoute: {
    Component:
      lazy(() =>
        import('./src/payment/CheckoutResultPage').then(m => m.default)
        .then(component => createAuthRequiredPage(component))
        .then(component => ({ default: component }))
      ),
  },
  NotFoundRoute: {
    Component:
      lazy(() =>
        import('./src/client/components/NotFoundPage').then(m => m.NotFoundPage)
        .then(component => ({ default: component }))
      ),
  },
} as const;


initializeQueryClient()

const rootElement =
  <App_ext />

export const routeObjects = getRouteObjects({
  routesMapping,
  rootElement,
})
