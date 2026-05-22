import { interpolatePath } from './linkHelpers'
import type {
  RouteDefinitionsToRoutes,
  OptionalRouteOptions,
  ParamValue,
  ExpandRouteOnOptionalStaticSegments,
} from './types'

// PUBLIC API
export const routes = {
  LandingPageRoute: {
    to: "/landing",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/landing",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  RootRoute: {
    to: "/",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  DashboardRoute: {
    to: "/dashboard",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/dashboard",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  OnboardingRoute: {
    to: "/onboarding",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/onboarding",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  LoginRoute: {
    to: "/login",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/login",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  SignupRoute: {
    to: "/signup",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/signup",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  RequestPasswordResetRoute: {
    to: "/request-password-reset",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/request-password-reset",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  PasswordResetRoute: {
    to: "/password-reset",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/password-reset",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  EmailVerificationRoute: {
    to: "/email-verification",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/email-verification",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  AccountRoute: {
    to: "/account",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/account",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  SettingsRoute: {
    to: "/settings",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/settings",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  ApiKeysRoute: {
    to: "/api-keys",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/api-keys",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  ReportsRoute: {
    to: "/reports/:scanId",
    build: (
      options: OptionalRouteOptions
      & { params: {"scanId": ParamValue;}}
    ) => interpolatePath(
        
        "/reports/:scanId",
        options.params,
        options?.search,
        options?.hash
      ),
  },
  ScanDetailsRoute: {
    to: "/scans/:scanId",
    build: (
      options: OptionalRouteOptions
      & { params: {"scanId": ParamValue;}}
    ) => interpolatePath(
        
        "/scans/:scanId",
        options.params,
        options?.search,
        options?.hash
      ),
  },
  WebhooksRoute: {
    to: "/webhooks",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/webhooks",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  NewScanRoute: {
    to: "/new-scan",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/new-scan",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  PricingPageRoute: {
    to: "/pricing",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/pricing",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  CheckoutResultRoute: {
    to: "/checkout",
    build: (
      options?:
      OptionalRouteOptions
    ) => interpolatePath(
        
        "/checkout",
        undefined,
        options?.search,
        options?.hash
      ),
  },
  NotFoundRoute: {
    to: "*",
    build: (
      options: OptionalRouteOptions
      & { params: {"*": ParamValue;}}
    ) => interpolatePath(
        
        "*",
        options.params,
        options?.search,
        options?.hash
      ),
  },
} as const;

// PRIVATE API
export type Routes = RouteDefinitionsToRoutes<typeof routes>

// PUBLIC API
export { Link } from './Link'
