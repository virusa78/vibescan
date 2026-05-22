/**
 * JWT Token Configuration
 * Defines token expiry times, rotation settings, and security parameters
 */
export const TOKEN_CONFIG = {
    // Access token: short-lived, used for API requests
    ACCESS_TOKEN_EXPIRY: 15 * 60, // 15 minutes in seconds (900s)
    // Refresh token: long-lived, used to obtain new access tokens
    REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60, // 30 days in seconds (2592000s)
    // Enable refresh token rotation: issue new refresh token on each refresh call
    REFRESH_TOKEN_ROTATION: true,
    // Algorithm for JWT signing
    ALGORITHM: 'HS256',
    // Token type headers
    TOKEN_TYPE_ACCESS: 'Bearer',
    TOKEN_TYPE_REFRESH: 'Refresh',
};
/**
 * Calculate token expiry timestamp
 * @param expirySeconds - Token expiry duration in seconds
 * @returns Unix timestamp (seconds since epoch)
 */
export function getTokenExpiry(expirySeconds) {
    return Math.floor(Date.now() / 1000) + expirySeconds;
}
/**
 * Check if token has expired
 * @param expiryTimestamp - Unix timestamp when token expires
 * @returns true if token is expired, false otherwise
 */
export function isTokenExpired(expiryTimestamp) {
    return Math.floor(Date.now() / 1000) >= expiryTimestamp;
}
//# sourceMappingURL=tokens.js.map