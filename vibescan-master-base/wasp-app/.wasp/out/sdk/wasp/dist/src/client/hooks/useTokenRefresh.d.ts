/**
 * useTokenRefresh Hook
 * Automatically handles token refresh on API 401 Unauthorized responses
 * Sets up interceptors for seamless token rotation
 */
/**
 * Hook for automatic token refresh on 401 Unauthorized
 * Should be initialized in App component
 */
export declare function useTokenRefresh(): {
    performRefresh: () => Promise<string | null>;
    handleUnauthorized: () => Promise<boolean>;
};
//# sourceMappingURL=useTokenRefresh.d.ts.map