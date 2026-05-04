import { interpolatePath } from './linkHelpers';
// PUBLIC API
export const routes = {
    LandingPageRoute: {
        to: "/landing",
        build: (options) => interpolatePath("/landing", undefined, options?.search, options?.hash),
    },
    RootRoute: {
        to: "/",
        build: (options) => interpolatePath("/", undefined, options?.search, options?.hash),
    },
    DashboardRoute: {
        to: "/dashboard",
        build: (options) => interpolatePath("/dashboard", undefined, options?.search, options?.hash),
    },
    OnboardingRoute: {
        to: "/onboarding",
        build: (options) => interpolatePath("/onboarding", undefined, options?.search, options?.hash),
    },
    LoginRoute: {
        to: "/login",
        build: (options) => interpolatePath("/login", undefined, options?.search, options?.hash),
    },
    SignupRoute: {
        to: "/signup",
        build: (options) => interpolatePath("/signup", undefined, options?.search, options?.hash),
    },
    RequestPasswordResetRoute: {
        to: "/request-password-reset",
        build: (options) => interpolatePath("/request-password-reset", undefined, options?.search, options?.hash),
    },
    PasswordResetRoute: {
        to: "/password-reset",
        build: (options) => interpolatePath("/password-reset", undefined, options?.search, options?.hash),
    },
    EmailVerificationRoute: {
        to: "/email-verification",
        build: (options) => interpolatePath("/email-verification", undefined, options?.search, options?.hash),
    },
    AccountRoute: {
        to: "/account",
        build: (options) => interpolatePath("/account", undefined, options?.search, options?.hash),
    },
    SettingsRoute: {
        to: "/settings",
        build: (options) => interpolatePath("/settings", undefined, options?.search, options?.hash),
    },
    ApiKeysRoute: {
        to: "/api-keys",
        build: (options) => interpolatePath("/api-keys", undefined, options?.search, options?.hash),
    },
    ReportsRoute: {
        to: "/reports/:scanId",
        build: (options) => interpolatePath("/reports/:scanId", options.params, options?.search, options?.hash),
    },
    ScanDetailsRoute: {
        to: "/scans/:scanId",
        build: (options) => interpolatePath("/scans/:scanId", options.params, options?.search, options?.hash),
    },
    WebhooksRoute: {
        to: "/webhooks",
        build: (options) => interpolatePath("/webhooks", undefined, options?.search, options?.hash),
    },
    NewScanRoute: {
        to: "/new-scan",
        build: (options) => interpolatePath("/new-scan", undefined, options?.search, options?.hash),
    },
    PricingPageRoute: {
        to: "/pricing",
        build: (options) => interpolatePath("/pricing", undefined, options?.search, options?.hash),
    },
    CheckoutResultRoute: {
        to: "/checkout",
        build: (options) => interpolatePath("/checkout", undefined, options?.search, options?.hash),
    },
    NotFoundRoute: {
        to: "*",
        build: (options) => interpolatePath("*", options.params, options?.search, options?.hash),
    },
};
// PUBLIC API
export { Link } from './Link';
//# sourceMappingURL=index.js.map