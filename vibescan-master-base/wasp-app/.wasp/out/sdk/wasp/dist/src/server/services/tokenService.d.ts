/**
 * Token Service
 * Handles JWT token generation, verification, and blacklisting
 */
interface TokenPayload {
    userId: string;
    jti: string;
    iat: number;
    exp: number;
    type: 'access' | 'refresh';
}
interface TokenPair {
    accessToken: string;
    refreshToken: string;
    accessTokenExpiresIn: number;
    refreshTokenExpiresIn: number;
}
/**
 * Generate a pair of access and refresh tokens
 * @param userId - User ID to encode in tokens
 * @returns Token pair with access and refresh tokens
 */
export declare function generateTokenPair(userId: string): Promise<TokenPair>;
/**
 * Verify and extract payload from refresh token
 * @param token - Refresh token to verify
 * @returns Token payload if valid, null otherwise
 */
export declare function verifyRefreshToken(token: string): Promise<TokenPayload | null>;
/**
 * Verify and extract payload from access token
 * @param token - Access token to verify
 * @returns Token payload if valid, null otherwise
 */
export declare function verifyAccessToken(token: string): Promise<TokenPayload | null>;
/**
 * Blacklist a token by adding it to Redis
 * Prevents token reuse after revocation
 * @param jti - JWT ID of token to blacklist
 * @param expiryTimestamp - Unix timestamp when token expires
 */
export declare function blacklistToken(jti: string, expiryTimestamp: number): Promise<void>;
/**
 * Check if a token has been blacklisted
 * @param jti - JWT ID of token to check
 * @returns true if token is blacklisted, false otherwise
 */
export declare function isTokenBlacklisted(jti: string): Promise<boolean>;
export type { TokenPayload, TokenPair };
//# sourceMappingURL=tokenService.d.ts.map