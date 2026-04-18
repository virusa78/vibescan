import { useEffect, useMemo } from "react";
import { Outlet, useLocation } from "react-router";
import { routes } from "wasp/client/router";
import { useAuth } from "wasp/client/auth";
import { Toaster } from "../client/components/ui/toaster";
import { useTokenRefresh } from "./hooks/useTokenRefresh";
import "./theme-init";
import "./Main.css";
import NavBar from "./components/NavBar/NavBar";
import Sidebar from "./components/Sidebar/Sidebar";
import {
  appNavigationItems,
  marketingNavigationItems,
} from "./components/NavBar/constants";
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

  // Redirect root path based on auth status
  useEffect(() => {
    if (!isAuthLoading && location.pathname === "/") {
      if (user) {
        // Authenticated: go to dashboard
        window.location.href = "/dashboard";
      } else {
        // Anonymous: go to landing page
        window.location.href = "/landing";
      }
    }
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
    return (
      location.pathname !== routes.LoginRoute.build() &&
      location.pathname !== routes.SignupRoute.build()
    );
  }, [location]);

  const shouldDisplaySidebar = useMemo(() => {
    return (
      user &&
      !isMarketingPage &&
      location.pathname !== routes.LoginRoute.build() &&
      location.pathname !== routes.SignupRoute.build()
    );
  }, [location, user, isMarketingPage]);

  const isAdminDashboard = useMemo(() => {
    return location.pathname.startsWith("/admin");
  }, [location]);

  useEffect(() => {
    // Initialize theme
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const stored = localStorage.getItem("theme");
    const isDark = stored ? stored === "dark" : prefersDark;
    
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
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

  return (
    <>
      <div className="bg-background text-foreground min-h-screen">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="bg-primary/15 absolute -top-28 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full blur-3xl" />
          <div className="bg-secondary/20 absolute right-0 bottom-0 h-96 w-96 translate-x-1/3 translate-y-1/4 rounded-full blur-3xl" />
        </div>
        {isAdminDashboard ? (
          <Outlet />
        ) : (
          <>
            {shouldDisplayAppNavBar && (
              <NavBar navigationItems={navigationItems} />
            )}
            {shouldDisplaySidebar && <Sidebar />}
            <main className={shouldDisplaySidebar ? "ml-56" : ""}>
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
