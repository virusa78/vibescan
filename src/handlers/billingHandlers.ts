/**
 * Billing API Handlers
 *
 * Handles billing-related API endpoints:
 * - Checkout session creation
 * - Subscription management
 * - Stripe webhook processing
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { billingService } from '../services/billingService.js';
import { apiKeyAuthMiddleware } from '../middleware/apiGateway.js';

// Type aliases for convenience
type Request = FastifyRequest;
type Reply = FastifyReply;

/**
 * Extract user ID from request (from JWT or API key)
 */
function extractUserId(request: any): string | null {
    // Check for JWT user (from auth middleware)
    if (request.user?.userId) {
        return request.user.userId;
    }
    // Check for API key user
    if (request.apiKey?.user_id) {
        return request.apiKey.user_id;
    }
    return null;
}

/**
 * Verify user owns the resource they're accessing
 * For billing, the user can only access their own billing data
 */
function verifyBillingOwnership(request: any, userId: string): boolean {
    const bodyUserId = request.body?.userId;
    const paramUserId = request.params?.userId;

    // If userId is provided in request, it must match authenticated user
    if (bodyUserId && bodyUserId !== userId) {
        return false;
    }
    if (paramUserId && paramUserId !== userId) {
        return false;
    }

    return true;
}

/**
 * Create Stripe checkout session
 * POST /billing/checkout
 */
export async function createCheckoutHandler(request: Request, reply: Reply) {
    try {
        // Extract and verify user ID
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({
                success: false,
                error: {
                    code: 'unauthorized',
                    message: 'Authentication required',
                },
            });
        }

        const { plan, region } = request.body as {
            plan: string;
            region?: string;
        };

        // Validate plan
        const validPlans = ['free_trial', 'starter', 'pro', 'enterprise'];
        if (!validPlans.includes(plan)) {
            return reply.code(400).send({
                success: false,
                error: {
                    code: 'invalid_plan',
                    message: `Invalid plan. Valid plans: ${validPlans.join(', ')}`,
                },
            });
        }

        // Validate region
        const validRegions = ['IN', 'PK', 'OTHER'];
        const userRegion = region && validRegions.includes(region) ? region : 'OTHER';

        // Create checkout session (user ID is from auth, not request body)
        const result = await billingService.createCheckoutSession(userId, plan, userRegion);

        reply.code(200).send({
            success: true,
            data: result,
        });
    } catch (error: any) {
        console.error('Create checkout session error:', error);
        reply.code(500).send({
            success: false,
            error: {
                code: error.code || 'internal_error',
                message: error.message || 'Failed to create checkout session',
            },
        });
    }
}

/**
 * Get subscription details
 * GET /billing/subscription
 */
export async function getSubscriptionHandler(request: Request, reply: Reply) {
    try {
        // Extract and verify user ID
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({
                success: false,
                error: {
                    code: 'unauthorized',
                    message: 'Authentication required',
                },
            });
        }

        // Verify ownership - user can only access their own subscription
        if (!verifyBillingOwnership(request, userId)) {
            return reply.code(403).send({
                success: false,
                error: {
                    code: 'forbidden',
                    message: 'Access denied',
                },
            });
        }

        const details = await billingService.getSubscriptionDetails(userId);

        if (!details) {
            return reply.code(404).send({
                success: false,
                error: {
                    code: 'subscription_not_found',
                    message: 'No subscription found for this user',
                },
            });
        }

        reply.code(200).send({
            success: true,
            data: details,
        });
    } catch (error: any) {
        console.error('Get subscription error:', error);
        reply.code(500).send({
            success: false,
            error: {
                code: error.code || 'internal_error',
                message: error.message || 'Failed to get subscription details',
            },
        });
    }
}

/**
 * Cancel subscription
 * POST /billing/cancel
 */
export async function cancelSubscriptionHandler(request: Request, reply: Reply) {
    try {
        // Extract and verify user ID
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({
                success: false,
                error: {
                    code: 'unauthorized',
                    message: 'Authentication required',
                },
            });
        }

        // Verify ownership
        if (!verifyBillingOwnership(request, userId)) {
            return reply.code(403).send({
                success: false,
                error: {
                    code: 'forbidden',
                    message: 'Access denied',
                },
            });
        }

        const { immediately } = request.body as {
            immediately?: boolean;
        };

        await billingService.cancelSubscription(userId, immediately === true);

        reply.code(200).send({
            success: true,
            data: {
                message: immediately
                    ? 'Subscription cancelled immediately'
                    : 'Subscription will be cancelled at period end',
            },
        });
    } catch (error: any) {
        console.error('Cancel subscription error:', error);
        reply.code(500).send({
            success: false,
            error: {
                code: error.code || 'internal_error',
                message: error.message || 'Failed to cancel subscription',
            },
        });
    }
}

/**
 * Process Stripe webhook
 * POST /billing/webhook
 */
export async function stripeWebhookHandler(request: Request, reply: Reply) {
    try {
        const signature = request.headers['stripe-signature'] as string;

        if (!signature) {
            return reply.code(400).send({
                success: false,
                error: {
                    code: 'missing_signature',
                    message: 'Missing Stripe signature header',
                },
            });
        }

        // Verify and process webhook
        const eventType = await billingService.handleStripeWebhook(
            request.body as Buffer,
            signature
        );

        reply.code(200).send({
            success: true,
            data: {
                received: true,
                eventType,
            },
        });
    } catch (error: any) {
        console.error('Stripe webhook error:', error);

        if (error.message?.includes('Invalid webhook signature')) {
            return reply.code(400).send({
                success: false,
                error: {
                    code: 'invalid_signature',
                    message: 'Invalid webhook signature',
                },
            });
        }

        reply.code(500).send({
            success: false,
            error: {
                code: 'webhook_processing_error',
                message: error.message || 'Failed to process webhook',
            },
        });
    }
}

/**
 * Get regional pricing information
 * GET /billing/regional-pricing
 */
export async function getRegionalPricingHandler(request: Request, reply: Reply) {
    try {
        const { region, plan } = request.query as {
            region?: string;
            plan?: string;
        };

        // Default to OTHER if not specified
        const userRegion = region || 'OTHER';

        // Base prices
        const basePrices: Record<string, number> = {
            free_trial: 0,
            starter: 29,
            pro: 99,
            enterprise: 499,
        };

        const targetPlan = plan || 'starter';
        const basePrice = basePrices[targetPlan] || 0;

        const pricing = billingService.calculateRegionalPricing(basePrice, userRegion);

        reply.code(200).send({
            success: true,
            data: {
                basePrice,
                region: pricing.region,
                discountPercent: pricing.discountPercent,
                discountedPrice: pricing.discountedPrice,
            },
        });
    } catch (error: any) {
        console.error('Get regional pricing error:', error);
        reply.code(500).send({
            success: false,
            error: {
                code: 'internal_error',
                message: 'Failed to calculate regional pricing',
            },
        });
    }
}
