/**
 * useTokenRefresh Hook
 * Automatically handles token refresh on API 401 Unauthorized responses
 * Sets up interceptors for seamless token rotation
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from 'wasp/client/auth';
import { refreshToken as refreshTokenAction } from 'wasp/client/operations';
/**
 * Hook for automatic token refresh on 401 Unauthorized
 * Should be initialized in App component
 */
export function useTokenRefresh() {
    const { data: user, isLoading: authLoading } = useAuth();
    const refreshPromiseRef = useRef(null);
    const refreshTimeoutRef = useRef(null);
    /**
     * Refresh the access token using the stored refresh token
     */
    const performRefresh = useCallback(async () => {
        // If already refreshing, wait for that promise
        if (refreshPromiseRef.current) {
            try {
                return await refreshPromiseRef.current;
            }
            catch {
                return null;
            }
        }
        const refreshTokenStored = localStorage.getItem('refresh_token');
        if (!refreshTokenStored) {
            console.warn('No refresh token available');
            return null;
        }
        // Create a new refresh promise
        const refreshPromise = (async () => {
            try {
                const result = await refreshTokenAction({
                    refreshToken: refreshTokenStored,
                });
                // Store new tokens
                localStorage.setItem('access_token', result.accessToken);
                localStorage.setItem('refresh_token', result.refreshToken);
                // Schedule next refresh before expiry (5 minutes before expiry)
                const expiresInMs = result.expiresIn * 1000;
                const refreshBeforeExpiryMs = expiresInMs - 5 * 60 * 1000;
                if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                }
                refreshTimeoutRef.current = setTimeout(performRefresh, Math.max(1000, refreshBeforeExpiryMs) // Minimum 1 second
                );
                return result.accessToken;
            }
            catch (error) {
                console.error('Token refresh failed:', error);
                // Clear stored tokens on refresh failure
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                return null;
            }
            finally {
                refreshPromiseRef.current = null;
            }
        })();
        refreshPromiseRef.current = refreshPromise;
        return await refreshPromise;
    }, []);
    /**
     * Handle 401 Unauthorized responses
     * Call this from an API error interceptor
     */
    const handleUnauthorized = useCallback(async () => {
        const newAccessToken = await performRefresh();
        return newAccessToken !== null;
    }, [performRefresh]);
    /**
     * Setup initial token refresh on component mount
     * Schedule refresh based on access token expiry
     */
    useEffect(() => {
        if (authLoading || !user) {
            return;
        }
        // Clear any existing timeout
        if (refreshTimeoutRef.current) {
            clearTimeout(refreshTimeoutRef.current);
        }
        // Check if we have a refresh token stored
        const refreshTokenStored = localStorage.getItem('refresh_token');
        if (refreshTokenStored) {
            // Schedule refresh before token expiry (5 minutes before)
            // Wasp default access token expiry is typically 15 minutes
            const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
            refreshTimeoutRef.current = setTimeout(performRefresh, REFRESH_BEFORE_EXPIRY_MS);
        }
        // Cleanup timeout on unmount
        return () => {
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
        };
    }, [user, authLoading, performRefresh]);
    return {
        performRefresh,
        handleUnauthorized,
    };
}
//# sourceMappingURL=useTokenRefresh.js.map