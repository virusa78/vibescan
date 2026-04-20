import { useEffect, useMemo } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { routes } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { Toaster } from "../client/components/ui/toaster";
import { applyTheme, readThemePreference } from "./theme";
import { useTokenRefresh } from "./hooks/useTokenRefresh";
import "./theme-init";
import "./Main.css";
import NavBar from "./components/NavBar/NavBar";
import { getAuthRedirectPath } from "./utils/routeGuard";
import { appNavigationItems, marketingNavigationItems } from "./components/NavBar/constants";
import CookieConsentBanner from "./components/cookie-consent/Banner";

/**
 * use this component to wrap all child components
 * this is useful for templates, themes, and context
 */
export default function App() {
  const location = useLocation();
  const { data: user, isLoading: isAuthLoading } = useAuth();
  
  // Initialize token refresh on mount
  useTokenRefresh();

  const redirectPath = useMemo(() => {
    if (isAuthLoading) {
      return null;
    }

    return getAuthRedirectPath({
      pathname: location.pathname,
      isAuthenticated: Boolean(user),
      publicRoutes: [
        routes.LandingPageRoute.to,
        routes.PricingPageRoute.to,
        routes.LoginRoute.to,
        routes.SignupRoute.to,
        routes.RequestPasswordResetRoute.to,
        routes.PasswordResetRoute.to,
        routes.EmailVerificationRoute.to,
      ],
      dashboardRoute: routes.DashboardRoute.to,
      loginRoute: routes.LoginRoute.to,
    });
  }, [location.pathname, user, isAuthLoading]);

  const isMarketingPage = useMemo(() => {
    return (
      location.pathname.startsWith("/landing") ||
      location.pathname.startsWith("/pricing")
    );
  }, [location]);

  const navigationItems = isMarketingPage
    ? marketingNavigationItems
    : appNavigationItems;

  const shouldDisplayAppNavBar = useMemo(() => {
    const isAuthPage = [
      routes.LoginRoute.build(),
      routes.SignupRoute.build(),
      routes.RequestPasswordResetRoute.build(),
      routes.PasswordResetRoute.build(),
      routes.EmailVerificationRoute.build(),
    ].includes(location.pathname);

    return (
      !isAuthPage &&
      !location.pathname.startsWith("/admin")
    );
  }, [location]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith("/admin");
  }, [location]);

  useEffect(() => {
    // Initialize theme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = readThemePreference(localStorage.getItem("theme"), prefersDark);

    applyTheme(theme);
  }, []);

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView();
      }
    }
  }, [location]);

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <>
      <div className="bg-background text-foreground min-h-screen">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.05),_transparent_42%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-15" />
        </div>
        {isAdminDashboard ? (
          <Outlet />
        ) : (
          <>
            {shouldDisplayAppNavBar && (
              <NavBar navigationItems={navigationItems} />
            )}
            <main>
              <Outlet />
            </main>
          </>
        )}
      </div>
      <Toaster position="bottom-right" />
      <CookieConsentBanner />
    </>
  );
}
