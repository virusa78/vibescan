/**
 * Authentication handlers
 *
 * Handles /auth/* endpoints
 */

import { authService } from '../services/authService.js';
import { createError } from '../utils/index.js';
import { isValidEmail } from '../utils/index.js';

/**
 * Register handler
 */
export async function registerHandler(request: any, reply: any): Promise<void> {
    const { email, password, region } = request.body;

    // Validate input
    if (!email || !password) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Email and password are required'
        });
        return;
    }

    if (!isValidEmail(email)) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Invalid email format'
        });
        return;
    }

    if (password.length < 8) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Password must be at least 8 characters'
        });
        return;
    }

    try {
        const user = await authService.register(email, password, region || 'OTHER');

        reply.code(201).send({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                plan: user.plan,
                region: user.region,
                created_at: user.created_at
            }
        });
    } catch (error: any) {
        if (error.code === '23505') { // PostgreSQL unique violation
            reply.code(409).send({
                error: 'email_taken',
                message: 'Email already registered'
            });
        } else {
            reply.code(500).send({
                error: 'internal_error',
                message: 'Failed to register user'
            });
        }
    }
}

/**
 * Login handler
 */
export async function loginHandler(request: any, reply: any): Promise<void> {
    const { email, password } = request.body;

    // Validate input
    if (!email || !password) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Email and password are required'
        });
        return;
    }

    try {
        const tokens = await authService.login(email, password);

        reply.code(200).send({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            }
        });
    } catch (error: any) {
        if (error.code === 'unauthorized') {
            reply.code(401).send({
                error: 'unauthorized',
                message: error.message || 'Invalid credentials'
            });
        } else {
            reply.code(500).send({
                error: 'internal_error',
                message: 'Failed to login'
            });
        }
    }
}

/**
 * Refresh token handler
 */
export async function refreshHandler(request: any, reply: any): Promise<void> {
    const { refreshToken } = request.body;

    if (!refreshToken) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Refresh token is required'
        });
        return;
    }

    try {
        const tokens = await authService.refreshTokens(refreshToken);

        reply.code(200).send({
            success: true,
            data: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken
            }
        });
    } catch (error: any) {
        if (error.code === 'unauthorized') {
            reply.code(401).send({
                error: 'unauthorized',
                message: error.message || 'Invalid refresh token'
            });
        } else {
            reply.code(500).send({
                error: 'internal_error',
                message: 'Failed to refresh token'
            });
        }
    }
}

/**
 * Logout handler
 */
export async function logoutHandler(request: any, reply: any): Promise<void> {
    const { refreshToken } = request.body;

    if (!refreshToken) {
        reply.code(400).send({
            error: 'validation_error',
            message: 'Refresh token is required'
        });
        return;
    }

    try {
        await authService.logout(refreshToken);

        reply.code(204).send();
    } catch (error: any) {
        reply.code(500).send({
            error: 'internal_error',
            message: 'Failed to logout'
        });
    }
}

/**
 * Get current user handler
 */
export async function getMeHandler(request: any, reply: any): Promise<void> {
    try {
        if (!request.user || !request.user.userId) {
            reply.code(401).send({
                error: 'unauthorized',
                message: 'Not authenticated'
            });
            return;
        }

        const user = await authService.getUserById(request.user.userId);

        if (!user) {
            reply.code(404).send({
                error: 'not_found',
                message: 'User not found'
            });
            return;
        }

        // Get quota information
        const quotaInfo = await authService.getUserQuota(request.user.userId);

        reply.code(200).send({
            success: true,
            data: {
                id: user.id,
                email: user.email,
                name: user.name,
                plan: user.plan,
                region: user.region,
                quota: quotaInfo.total,
                quota_used: quotaInfo.used,
                created_at: user.created_at
            }
        });
    } catch (error: any) {
        reply.code(500).send({
            error: 'internal_error',
            message: 'Failed to fetch user data'
        });
    }
}

export default {
    registerHandler,
    loginHandler,
    refreshHandler,
    logoutHandler
};
