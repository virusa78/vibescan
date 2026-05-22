/**
 * Refresh Token Operation
 * Accepts a refresh token and returns a new access token + refresh token pair
 * Implements token rotation for enhanced security
 */
import * as z from 'zod';
declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RefreshTokenResponse = {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
};
/**
 * Refresh Token Action
 * Takes a refresh token and issues a new access + refresh token pair
 * Old refresh token is automatically blacklisted (token rotation)
 */
export declare function refreshToken(rawArgs: unknown, _context: unknown): Promise<any>;
export {};
//# sourceMappingURL=refreshToken.d.ts.map