/**
 * JWT Token Configuration
 * Defines token expiry times, rotation settings, and security parameters
 */
export declare const TOKEN_CONFIG: {
    readonly ACCESS_TOKEN_EXPIRY: number;
    readonly REFRESH_TOKEN_EXPIRY: number;
    readonly REFRESH_TOKEN_ROTATION: true;
    readonly ALGORITHM: "HS256";
    readonly TOKEN_TYPE_ACCESS: "Bearer";
    readonly TOKEN_TYPE_REFRESH: "Refresh";
};
/**
 * Calculate token expiry timestamp
 * @param expirySeconds - Token expiry duration in seconds
 * @returns Unix timestamp (seconds since epoch)
 */
export declare function getTokenExpiry(expirySeconds: number): number;
/**
 * Check if token has expired
 * @param expiryTimestamp - Unix timestamp when token expires
 * @returns true if token is expired, false otherwise
 */
export declare function isTokenExpired(expiryTimestamp: number): boolean;
//# sourceMappingURL=tokens.d.ts.map