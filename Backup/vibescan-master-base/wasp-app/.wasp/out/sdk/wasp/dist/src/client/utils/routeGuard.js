export const normalizePathname = (pathname) => {
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
export const isPublicRoute = (pathname, publicRoutes) => {
    const normalizedPath = normalizePathname(pathname);
    return publicRoutes.some((route) => {
        const normalizedRoute = normalizePathname(route);
        if (normalizedRoute === "/") {
            return normalizedPath === "/";
        }
        return (normalizedPath === normalizedRoute ||
            normalizedPath.startsWith(`${normalizedRoute}/`));
    });
};
export const getAuthRedirectPath = ({ pathname, isAuthenticated, publicRoutes, dashboardRoute, loginRoute, rootPath = "/", }) => {
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
//# sourceMappingURL=routeGuard.js.map