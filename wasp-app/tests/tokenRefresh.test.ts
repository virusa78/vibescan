/**
 * Token Refresh Tests
 * Unit tests for JWT token generation, verification, and blacklisting
 */

// Mock process.env for testing
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';

import {
  generateTokenPair,
  verifyRefreshToken,
  verifyAccessToken,
  type TokenPayload,
} from '../src/server/services/tokenService';
import { TOKEN_CONFIG, isTokenExpired, getTokenExpiry } from '../src/server/config/tokens';

describe('Token Service', () => {
  describe('generateTokenPair', () => {
    test('should generate valid access and refresh tokens', async () => {
      const userId = 'user-123';
      const tokens = await generateTokenPair(userId);

      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(tokens.accessTokenExpiresIn).toBe(TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY);
      expect(tokens.refreshTokenExpiresIn).toBe(TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY);
    });

    test('should generate tokens with correct format (3 parts separated by dots)', async () => {
      const userId = 'user-456';
      const tokens = await generateTokenPair(userId);

      const accessParts = tokens.accessToken.split('.');
      const refreshParts = tokens.refreshToken.split('.');

      expect(accessParts.length).toBe(3);
      expect(refreshParts.length).toBe(3);
    });

    test('should generate different tokens for the same user', async () => {
      const userId = 'user-789';
      const tokens1 = await generateTokenPair(userId);
      const tokens2 = await generateTokenPair(userId);

      // Tokens should be different due to unique JTI
      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('verifyRefreshToken', () => {
    test('should verify a valid refresh token', async () => {
      const userId = 'user-verify-1';
      const tokens = await generateTokenPair(userId);

      const payload = await verifyRefreshToken(tokens.refreshToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
      expect(payload?.type).toBe('refresh');
      expect(payload?.jti).toBeDefined();
    });

    test('should reject an invalid refresh token', async () => {
      const invalidToken = 'invalid.token.here';
      const payload = await verifyRefreshToken(invalidToken);

      expect(payload).toBeNull();
    });

    test('should reject an access token as refresh token', async () => {
      const userId = 'user-verify-2';
      const tokens = await generateTokenPair(userId);

      const payload = await verifyRefreshToken(tokens.accessToken);

      // Should reject because it's an access token, not refresh
      expect(payload).toBeNull();
    });

    test('should reject tampered tokens', async () => {
      const userId = 'user-verify-3';
      const tokens = await generateTokenPair(userId);

      // Tamper with the token by changing a character
      const tamperedToken = tokens.refreshToken.replace(/a/g, 'b');

      const payload = await verifyRefreshToken(tamperedToken);

      expect(payload).toBeNull();
    });
  });

  describe('verifyAccessToken', () => {
    test('should verify a valid access token', async () => {
      const userId = 'user-access-1';
      const tokens = await generateTokenPair(userId);

      const payload = await verifyAccessToken(tokens.accessToken);

      expect(payload).toBeDefined();
      expect(payload?.userId).toBe(userId);
      expect(payload?.type).toBe('access');
    });

    test('should reject a refresh token as access token', async () => {
      const userId = 'user-access-2';
      const tokens = await generateTokenPair(userId);

      const payload = await verifyAccessToken(tokens.refreshToken);

      // Should reject because it's a refresh token, not access
      expect(payload).toBeNull();
    });
  });

  describe('Token Expiry', () => {
    test('should have correct expiry times in payload', async () => {
      const userId = 'user-expiry';
      const tokens = await generateTokenPair(userId);

      const accessPayload = await verifyAccessToken(tokens.accessToken);
      const refreshPayload = await verifyRefreshToken(tokens.refreshToken);

      expect(accessPayload).toBeDefined();
      expect(refreshPayload).toBeDefined();

      // Access token should expire sooner than refresh token
      if (accessPayload && refreshPayload) {
        expect(refreshPayload.exp).toBeGreaterThan(accessPayload.exp);
      }
    });
  });

  describe('getTokenExpiry', () => {
    test('should calculate correct expiry timestamp', () => {
      const before = Math.floor(Date.now() / 1000);
      const expiry = getTokenExpiry(300); // 5 minutes
      const after = Math.floor(Date.now() / 1000);

      expect(expiry).toBeGreaterThanOrEqual(before + 300);
      expect(expiry).toBeLessThanOrEqual(after + 300 + 1);
    });
  });

  describe('isTokenExpired', () => {
    test('should identify expired tokens', () => {
      const pastTimestamp = Math.floor(Date.now() / 1000) - 100;
      expect(isTokenExpired(pastTimestamp)).toBe(true);
    });

    test('should identify non-expired tokens', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 1000;
      expect(isTokenExpired(futureTimestamp)).toBe(false);
    });
  });

  describe('Token JTI uniqueness', () => {
    test('should generate unique JTI for each token', async () => {
      const userId = 'user-jti-uniqueness';
      const tokens1 = await generateTokenPair(userId);
      const tokens2 = await generateTokenPair(userId);

      const payload1 = await verifyRefreshToken(tokens1.refreshToken);
      const payload2 = await verifyRefreshToken(tokens2.refreshToken);

      expect(payload1?.jti).not.toBe(payload2?.jti);
    });
  });

  describe('TOKEN_CONFIG constants', () => {
    test('should have correct token expiry times', () => {
      expect(TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY).toBe(15 * 60); // 15 minutes
      expect(TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY).toBe(30 * 24 * 60 * 60); // 30 days
    });

    test('should have token rotation enabled', () => {
      expect(TOKEN_CONFIG.REFRESH_TOKEN_ROTATION).toBe(true);
    });

    test('should use HS256 algorithm', () => {
      expect(TOKEN_CONFIG.ALGORITHM).toBe('HS256');
    });
  });
});
