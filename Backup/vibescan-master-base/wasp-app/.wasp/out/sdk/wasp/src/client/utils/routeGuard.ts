export const normalizePathname = (pathname: string): string => {
  if (!pathname) {
    return "/";
  }

  const trimmedPathname = pathname.trim();
  if (!trimmedPathname) {
    return "/";
  }

  if (trimmedPathname.length > 1) {
    const withoutTrailing = trimmedPathname.replace(/\/+$/, "");
    return withoutTrailing || "/";
  }

  return trimmedPathname;
};

export const isPublicRoute = (
  pathname: string,
  publicRoutes: string[],
): boolean => {
  const normalizedPath = normalizePathname(pathname);

  return publicRoutes.some((route) => {
    const normalizedRoute = normalizePathname(route);
    if (normalizedRoute === "/") {
      return normalizedPath === "/";
    }

    return (
      normalizedPath === normalizedRoute ||
      normalizedPath.startsWith(`${normalizedRoute}/`)
    );
  });
};

type AuthRedirectArgs = {
  pathname: string;
  isAuthenticated: boolean;
  publicRoutes: string[];
  dashboardRoute: string;
  loginRoute: string;
  rootPath?: string;
};

export const getAuthRedirectPath = ({
  pathname,
  isAuthenticated,
  publicRoutes,
  dashboardRoute,
  loginRoute,
  rootPath = "/",
}: AuthRedirectArgs): string | null => {
  const normalizedPath = normalizePathname(pathname);
  const normalizedRoot = normalizePathname(rootPath);

  if (normalizedPath === normalizedRoot) {
    return isAuthenticated ? dashboardRoute : loginRoute;
  }

  if (!isAuthenticated && !isPublicRoute(normalizedPath, publicRoutes)) {
    return loginRoute;
  }

  return null;
};
