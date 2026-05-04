export declare const normalizePathname: (pathname: string) => string;
export declare const isPublicRoute: (pathname: string, publicRoutes: string[]) => boolean;
type AuthRedirectArgs = {
    pathname: string;
    isAuthenticated: boolean;
    publicRoutes: string[];
    dashboardRoute: string;
    loginRoute: string;
    rootPath?: string;
};
export declare const getAuthRedirectPath: ({ pathname, isAuthenticated, publicRoutes, dashboardRoute, loginRoute, rootPath, }: AuthRedirectArgs) => string | null;
export {};
//# sourceMappingURL=routeGuard.d.ts.map