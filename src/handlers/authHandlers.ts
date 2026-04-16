/**
 * Authentication handlers
 *
 * Handles /auth/* endpoints
 */

import { authService } from '../services/authService.js';
import { createError } from '../utils/index.js';
import { isValidEmail } from '../utils/index.js';

const BLOCKED_DOMAINS = new Set(['tempmail.com', 'guerrillamail.com', 'mailinator.com']);

function isBlockedEmailDomain(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return !!domain && BLOCKED_DOMAINS.has(domain);
}

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

    if (!isValidEmail(email) || isBlockedEmailDomain(email)) {
        reply.code(400).send({
            error: 'validation_error',
            validation_errors: [{ field: 'email', message: 'Invalid email format or blocked domain' }]
        });
        return;
    }

    if (password.length < 12) {
        reply.code(400).send({
            error: 'validation_error',
            validation_errors: [{ field: 'password', message: 'Password must be at least 12 characters' }]
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
                timezone: user.timezone || 'UTC',
                language: user.language || 'en',
                account_locked: false,
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

/**
 * POST /me/email/change
 */
export async function requestEmailChangeHandler(request: any, reply: any): Promise<void> {
    try {
        if (!request.user || !request.user.userId) {
            reply.code(401).send({ error: 'unauthorized', message: 'Not authenticated' });
            return;
        }

        const { new_email, current_password } = request.body || {};
        if (!new_email || !current_password) {
            reply.code(400).send({
                error: 'validation_error',
                validation_errors: [
                    { field: 'new_email', message: 'new_email is required' },
                    { field: 'current_password', message: 'current_password is required' }
                ]
            });
            return;
        }

        if (!isValidEmail(new_email) || isBlockedEmailDomain(new_email)) {
            reply.code(400).send({
                error: 'validation_error',
                validation_errors: [{ field: 'new_email', message: 'Invalid email format or blocked domain' }]
            });
            return;
        }

        await authService.requestEmailChange(request.user.userId, new_email, current_password);
        reply.code(202).send({ success: true, data: { status: 'verification_sent' } });
    } catch (error: any) {
        if (error.code === 'unauthorized') {
            reply.code(401).send({ error: 'unauthorized', message: error.message });
            return;
        }
        if (error.code === 'not_found') {
            reply.code(404).send({ error: 'not_found', message: error.message });
            return;
        }
        reply.code(500).send({ error: 'internal_error', message: 'Failed to initiate email change' });
    }
}

/**
 * POST /me/email/verify
 */
export async function verifyEmailChangeHandler(request: any, reply: any): Promise<void> {
    try {
        const { token } = request.body || {};
        if (!token) {
            reply.code(400).send({
                error: 'validation_error',
                validation_errors: [{ field: 'token', message: 'token is required' }]
            });
            return;
        }

        await authService.verifyEmailChange(token);
        reply.code(200).send({ success: true, data: { status: 'email_updated' } });
    } catch (error: any) {
        if (error.code === 'validation_error') {
            reply.code(400).send({
                error: 'validation_error',
                validation_errors: [{ field: 'token', message: error.message }]
            });
            return;
        }
        if (error.code === 'email_taken') {
            reply.code(409).send({ error: 'email_taken', message: error.message });
            return;
        }
        reply.code(500).send({ error: 'internal_error', message: 'Failed to verify email change' });
    }
}

export default {
    registerHandler,
    loginHandler,
    refreshHandler,
    logoutHandler,
    getMeHandler,
    requestEmailChangeHandler,
    verifyEmailChangeHandler
};
