import type { RouteDefinitionsToRoutes, OptionalRouteOptions, ParamValue } from './types';
export declare const routes: {
    readonly LandingPageRoute: {
        readonly to: "/landing";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly RootRoute: {
        readonly to: "/";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly DashboardRoute: {
        readonly to: "/dashboard";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly OnboardingRoute: {
        readonly to: "/onboarding";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly LoginRoute: {
        readonly to: "/login";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly SignupRoute: {
        readonly to: "/signup";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly RequestPasswordResetRoute: {
        readonly to: "/request-password-reset";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly PasswordResetRoute: {
        readonly to: "/password-reset";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly EmailVerificationRoute: {
        readonly to: "/email-verification";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly AccountRoute: {
        readonly to: "/account";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly SettingsRoute: {
        readonly to: "/settings";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly ApiKeysRoute: {
        readonly to: "/api-keys";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly ReportsRoute: {
        readonly to: "/reports/:scanId";
        readonly build: (options: OptionalRouteOptions & {
            params: {
                "scanId": ParamValue;
            };
        }) => string;
    };
    readonly ScanDetailsRoute: {
        readonly to: "/scans/:scanId";
        readonly build: (options: OptionalRouteOptions & {
            params: {
                "scanId": ParamValue;
            };
        }) => string;
    };
    readonly WebhooksRoute: {
        readonly to: "/webhooks";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly NewScanRoute: {
        readonly to: "/new-scan";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly PricingPageRoute: {
        readonly to: "/pricing";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly CheckoutResultRoute: {
        readonly to: "/checkout";
        readonly build: (options?: OptionalRouteOptions) => string;
    };
    readonly NotFoundRoute: {
        readonly to: "*";
        readonly build: (options: OptionalRouteOptions & {
            params: {
                "*": ParamValue;
            };
        }) => string;
    };
};
export type Routes = RouteDefinitionsToRoutes<typeof routes>;
export { Link } from './Link';
//# sourceMappingURL=index.d.ts.map