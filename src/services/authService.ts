/**
 * AuthService
 *
 * Handles user registration, authentication, JWT token generation,
 * and API key management.
 */

import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../database/client.js';
import { generateSecureString } from '../utils/index.js';
import config from '../config/index.js';
import { User, ApiKey } from '../types/index.js';
import { storeSession, deleteSession, getSession } from '../redis/sessions.js';
import crypto from 'crypto';
import { createRequire } from 'module';

// Constants
const BCRYPT_ROUNDS = 10;
const JWT_ACCESS_EXPIRY = config.JWT_ACCESS_EXPIRY;
const JWT_REFRESH_EXPIRY = config.JWT_REFRESH_EXPIRY;

// JWT Secret from config
const JWT_SECRET = config.JWT_SECRET;

// Create require for CommonJS modules (jsonwebtoken)
const require = createRequire(import.meta.url);

// Utility functions for JWT
// Use dynamic require for jsonwebtoken to work with tsx
let _jwt: any;
function loadJWTModuleSync(): any {
    if (!_jwt) {
        try {
            _jwt = require('jsonwebtoken');
        } catch (e) {
            throw e;
        }
    }
    return _jwt;
}

async function generateJWT(payload: any, expiry: string): Promise<string> {
    const jwtModule = loadJWTModuleSync();
    return jwtModule.sign(payload, JWT_SECRET, { expiresIn: expiry });
}

async function verifyJWT(token: string): Promise<any> {
    const jwtModule = loadJWTModuleSync();
    try {
        return jwtModule.verify(token, JWT_SECRET);
    } catch (error) {
        return null;
    }
}

/**
 * AuthService interface implementation
 */
export class AuthService {
    private pool: any;

    constructor() {
        this.pool = getPool();
    }

    /**
     * Register a new user
     * @param email - User email
     * @param password - User password
     * @param region - User region (IN, PK, OTHER)
     * @returns Created user
     */
    async register(email: string, password: string, region: string = 'OTHER'): Promise<User> {
        const userId = uuidv4();
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Generate Stripe customer ID (placeholder for actual Stripe integration)
        const stripeCustomerId = `cus_${generateSecureString(24)}`;

        await this.pool.query(
            `INSERT INTO users (id, email, password_hash, plan, region, stripe_customer_id_encrypted)
             VALUES ($1, $2, $3, 'free_trial', $4, pgp_sym_encrypt($5, $6))
             RETURNING id, email, plan, region, created_at`,
            [userId, email, passwordHash, region, stripeCustomerId, config.ENCRYPTION_KEY]
        );

        // Get the created user
        const result = await this.pool.query(
            'SELECT id, email, plan, region, created_at FROM users WHERE id = $1',
            [userId]
        );

        return result.rows[0];
    }

    /**
     * Login a user and return JWT tokens
     * @param email - User email
     * @param password - User password
     * @returns Access token and refresh token
     */
    async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
        // Find user by email
        const result = await this.pool.query(
            'SELECT id, email, password_hash, plan, stripe_customer_id_encrypted, created_at FROM users WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            throw { code: 'unauthorized', message: 'Invalid credentials' };
        }

        const user = result.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordValid) {
            throw { code: 'unauthorized', message: 'Invalid credentials' };
        }

        // Generate tokens
        const accessToken = await this.generateAccessToken(user);
        const refreshToken = await this.generateRefreshToken(user);

        // Store refresh token in Redis
        await storeSession(refreshToken, {
            userId: user.id,
            email: user.email,
            plan: user.plan,
            expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
        });

        // Update last active at
        await this.pool.query(
            'UPDATE users SET last_active_at = NOW() WHERE id = $1',
            [user.id]
        );

        return {
            accessToken,
            refreshToken
        };
    }

    /**
     * Generate access token
     */
    private async generateAccessToken(user: any): Promise<string> {
        const payload = {
            userId: user.id,
            email: user.email,
            plan: user.plan,
            iat: Math.floor(Date.now() / 1000)
        };
        return await generateJWT(payload, '15m');
    }

    /**
     * Generate refresh token
     */
    private async generateRefreshToken(user: any): Promise<string> {
        const payload = {
            userId: user.id,
            iat: Math.floor(Date.now() / 1000)
        };
        return await generateJWT(payload, '30d');
    }

    /**
     * Refresh tokens using refresh token
     * @param refreshToken - Refresh token
     * @returns New access token and refresh token
     */
    async refreshTokens(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
        // Verify refresh token
        const payload = await verifyJWT(refreshToken);
        if (!payload) {
            throw { code: 'unauthorized', message: 'Invalid refresh token' };
        }

        // Get session from Redis
        const session = await getSession(refreshToken);

        if (!session) {
            throw { code: 'unauthorized', message: 'Session not found' };
        }

        // Check if session is expired
        if (session.expiresAt < Math.floor(Date.now() / 1000)) {
            await deleteSession(refreshToken);
            throw { code: 'unauthorized', message: 'Session expired' };
        }

        // Invalidate old refresh token
        await deleteSession(refreshToken);

        // Get user data
        const result = await this.pool.query(
            'SELECT id, email, plan, stripe_customer_id_encrypted, created_at FROM users WHERE id = $1',
            [payload.userId]
        );

        if (result.rows.length === 0) {
            throw { code: 'unauthorized', message: 'User not found' };
        }

        const user = result.rows[0];

        // Generate new tokens
        const newAccessToken = await this.generateAccessToken(user);
        const newRefreshToken = await this.generateRefreshToken(user);

        // Store new refresh token
        await storeSession(newRefreshToken, {
            userId: user.id,
            email: user.email,
            plan: user.plan,
            expiresAt: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
        });

        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
    }

    /**
     * Logout user and invalidate refresh token
     * @param refreshToken - Refresh token to invalidate
     */
    async logout(refreshToken: string): Promise<void> {
        await deleteSession(refreshToken);
    }

    /**
     * Generate a new API key for a user
     * @param userId - User ID
     * @param label - API key label
     * @param scopes - API key scopes
     * @returns Raw API key and key ID
     */
    async generateApiKey(
        userId: string,
        label: string,
        scopes: string[] = ['scan_read']
    ): Promise<{ rawKey: string; keyId: string }> {
        // Generate cryptographically random key with "vs_" prefix
        const rawKey = `vs_${generateSecureString(32)}`;
        const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);
        const keyPrefix = rawKey.substring(0, 8);

        // Store in database
        const result = await this.pool.query(
            `INSERT INTO api_keys (user_id, key_prefix, key_hash, label, scopes)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, key_prefix`,
            [userId, keyPrefix, keyHash, label, scopes]
        );

        return {
            rawKey,
            keyId: result.rows[0].id
        };
    }

    /**
     * Verify an API key
     * @param key - Raw API key
     * @returns ApiKey if valid, null otherwise
     */
    async verifyApiKey(key: string): Promise<ApiKey | null> {
        const keyPrefix = key.substring(0, 8);

        // Look up by prefix
        const result = await this.pool.query(
            `SELECT id, user_id, key_prefix, key_hash, label, scopes, last_used_at,
                    expires_at, revoked_at, created_at
             FROM api_keys WHERE key_prefix = $1`,
            [keyPrefix]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const apiKey = result.rows[0];

        // Check if revoked
        if (apiKey.revoked_at) {
            return null;
        }

        // Check if expired
        if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
            return null;
        }

        // Verify hash
        const isHashValid = await bcrypt.compare(key, apiKey.key_hash);
        if (!isHashValid) {
            return null;
        }

        // Update last used at
        await this.pool.query(
            'UPDATE api_keys SET last_used_at = NOW() WHERE id = $1',
            [apiKey.id]
        );

        return {
            id: apiKey.id,
            user_id: apiKey.user_id,
            key_prefix: apiKey.key_prefix,
            key_hash: apiKey.key_hash,
            label: apiKey.label,
            scopes: apiKey.scopes,
            last_used_at: apiKey.last_used_at,
            expires_at: apiKey.expires_at,
            revoked_at: apiKey.revoked_at,
            created_at: apiKey.created_at
        };
    }

    /**
     * Revoke an API key
     * @param keyId - API key ID
     */
    async revokeApiKey(keyId: string): Promise<void> {
        await this.pool.query(
            'UPDATE api_keys SET revoked_at = NOW() WHERE id = $1',
            [keyId]
        );
    }

    /**
     * List API keys for a user
     * @param userId - User ID
     * @returns List of API keys (without key_hash)
     */
    async listApiKeys(userId: string): Promise<ApiKey[]> {
        const result = await this.pool.query(
            `SELECT id, user_id, key_prefix, label, scopes, last_used_at,
                    expires_at, revoked_at, created_at
             FROM api_keys WHERE user_id = $1
             ORDER BY created_at DESC`,
            [userId]
        );

        return result.rows;
    }

    /**
     * Verify API key from request headers
     * @param authorizationHeader - Authorization header value
     * @returns ApiKey if valid, null otherwise
     */
    async verifyApiKeyFromHeader(authorizationHeader: string): Promise<ApiKey | null> {
        if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
            return null;
        }

        const key = authorizationHeader.substring(7);
        return this.verifyApiKey(key);
    }

    /**
     * Get user by ID
     * @param userId - User ID
     * @returns User object or null
     */
    async getUserById(userId: string): Promise<User | null> {
        const result = await this.pool.query(
            'SELECT id, email, name, plan, region, created_at FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    /**
     * Get user quota information
     * @param userId - User ID
     * @returns Quota info with total and used counts
     */
    async getUserQuota(userId: string): Promise<{ total: number; used: number }> {
        // Get user's plan to determine quota
        const userResult = await this.pool.query(
            'SELECT plan FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            return { total: 10, used: 0 };
        }

        const plan = userResult.rows[0].plan;
        const quotaLimits: Record<string, number> = {
            free_trial: 10,
            starter: 50,
            pro: 100,
            enterprise: 1000
        };

        const total = quotaLimits[plan] || 10;

        // Get current month's usage - month column stores YYYY-MM format
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

        const usageResult = await this.pool.query(
            `SELECT COALESCE(SUM(scans_used), 0) as used
             FROM quota_ledger
             WHERE user_id = $1
             AND month = $2`,
            [userId, currentMonth]
        );

        const used = parseInt(usageResult.rows[0].used) || 0;

        return { total, used };
    }
}

export const authService = new AuthService();

export default authService;
