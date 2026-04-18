/**
 * Refresh Token Operation
 * Accepts a refresh token and returns a new access token + refresh token pair
 * Implements token rotation for enhanced security
 */

import { HttpError } from 'wasp/server';
import * as z from 'zod';
import {
  verifyRefreshToken,
  generateTokenPair,
  blacklistToken,
  isTokenBlacklisted,
} from '../../services/tokenService';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation';

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Invalid refresh token'),
});

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
export async function refreshToken(
  rawArgs: any,
  context: any
): Promise<RefreshTokenResponse> {
  // Validate input
  const args = ensureArgsSchemaOrThrowHttpError(refreshTokenSchema, rawArgs);

  try {
    // Verify the refresh token
    const payload = await verifyRefreshToken(args.refreshToken);

    if (!payload) {
      throw new HttpError(401, 'Invalid or expired refresh token');
    }

    // Check if refresh token has been blacklisted
    const isBlacklisted = await isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new HttpError(401, 'Refresh token has been revoked');
    }

    // Generate new token pair (token rotation)
    const newTokenPair = await generateTokenPair(payload.userId);

    // Blacklist old refresh token (after successful new token generation)
    try {
      await blacklistToken(payload.jti, payload.exp);
    } catch (error) {
      // Log but don't fail - user still gets new tokens
      console.warn('Failed to blacklist old refresh token:', error);
    }

    return {
      accessToken: newTokenPair.accessToken,
      refreshToken: newTokenPair.refreshToken,
      expiresIn: newTokenPair.accessTokenExpiresIn,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    console.error('Token refresh failed:', error);
    throw new HttpError(500, 'Failed to refresh token');
  }
}
