/**
 * BillingService
 *
 * Manages Stripe billing, subscription handling, and regional pricing.
 * - Creates Stripe checkout sessions with regional discounts
 * - Handles Stripe webhooks for subscription lifecycle
 * - Manages plan upgrades/downgrades
 */

import { getPool } from '../database/client.js';

// Regional pricing configuration
const REGIONAL_DISCOUNTS: Record<string, number> = {
    IN: 0.50, // 50% discount for India
    PK: 0.50, // 50% discount for Pakistan
    OTHER: 0.00, // No discount for other regions
};

// Stripe price IDs by plan (configure these in your Stripe dashboard)
const STRIPE_PRICE_IDS: Record<string, string> = {
    free_trial: process.env.STRIPE_PRICE_FREE || 'price_free_trial',
    starter: process.env.STRIPE_PRICE_STARTER || 'price_starter',
    pro: process.env.STRIPE_PRICE_PRO || 'price_pro',
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE || 'price_enterprise',
};

/**
 * Regional pricing result
 */
interface RegionalPricing {
    originalPrice: number;
    discountPercent: number;
    discountedPrice: number;
    region: string;
}

/**
 * Stripe checkout session creation result
 */
interface CheckoutSessionResult {
    sessionId: string;
    url: string;
    plan: string;
}

/**
 * Stripe webhook payload types
 */
interface StripeWebhookEvent {
    id: string;
    object: string;
    type: string;
    data: {
        object: {
            id: string;
            object: string;
            customer?: string;
            subscription?: string;
            status: string;
            plan?: {
                id: string;
                product: string;
                amount: number;
                currency: string;
                interval: string;
            };
            cancel_at_period_end?: boolean;
            current_period_start: number;
            current_period_end: number;
            items?: {
                data: Array<{
                    price: {
                        id: string;
                        product: string;
                        unit_amount: number;
                        currency: string;
                    };
                }>;
            };
            metadata?: Record<string, string>;
        };
    };
    created: number;
}

/**
 * Billing service class
 */
export class BillingService {
    private pool: any;
    private stripeSecretKey: string | null;
    private stripeWebhookSecret: string | null;

    constructor() {
        this.pool = getPool();
        this.stripeSecretKey = process.env.STRIPE_SECRET_KEY || null;
        this.stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || null;
    }

    /**
     * Check if Stripe is configured
     */
    private isStripeConfigured(): boolean {
        return !!this.stripeSecretKey;
    }

    private async getStripeClient(): Promise<any> {
        const stripeModule = await import('stripe');
        const StripeCtor = (stripeModule as any).default;
        return new StripeCtor(this.stripeSecretKey);
    }

    /**
     * Get regional discount for a user's region
     * @param region - User's region (IN, PK, or OTHER)
     * @returns Discount percentage (0.0 to 0.5)
     */
    getRegionalDiscount(region: string): number {
        return REGIONAL_DISCOUNTS[region] || REGIONAL_DISCOUNTS['OTHER'];
    }

    /**
     * Calculate regional pricing
     * @param basePrice - Base price in USD
     * @param region - User's region
     * @returns Regional pricing with discount applied
     */
    calculateRegionalPricing(basePrice: number, region: string): RegionalPricing {
        const discountPercent = this.getRegionalDiscount(region);
        const discountedPrice = basePrice * (1 - discountPercent);

        return {
            originalPrice: basePrice,
            discountPercent: discountPercent * 100,
            discountedPrice,
            region,
        };
    }

    /**
     * Create Stripe checkout session with regional pricing
     * @param userId - User ID
     * @param plan - Target plan (starter, pro, enterprise)
     * @param region - User's region for pricing
     * @returns Checkout session result with Stripe URL
     */
    async createCheckoutSession(
        userId: string,
        plan: string,
        region: string = 'OTHER'
    ): Promise<CheckoutSessionResult> {
        if (!this.isStripeConfigured()) {
            throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY.');
        }

        // Get user to check current plan
        const pool = getPool();
        const userResult = await pool.query(
            'SELECT id, email, plan, region FROM users WHERE id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            throw new Error('User not found');
        }

        const user = userResult.rows[0];

        // Validate plan
        const validPlans = ['free_trial', 'starter', 'pro', 'enterprise'];
        if (!validPlans.includes(plan)) {
            throw new Error(`Invalid plan. Valid plans: ${validPlans.join(', ')}`);
        }

        // Calculate regional pricing
        // Base prices (USD)
        const basePrices: Record<string, number> = {
            free_trial: 0,
            starter: 29,
            pro: 99,
            enterprise: 499,
        };

        const basePrice = basePrices[plan];
        const pricing = this.calculateRegionalPricing(basePrice, region);

        // Create Stripe checkout session
        const stripeClient = await this.getStripeClient();

        const session = await stripeClient.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: STRIPE_PRICE_IDS[plan],
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            customer_email: user.email,
            success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/billing/cancel`,
            metadata: {
                user_id: userId,
                plan: plan,
                region: region,
                discount_percent: pricing.discountPercent.toString(),
            },
            discounts: pricing.discountPercent > 0
                ? [{
                    coupon: this.createRegionalDiscountCoupon(region, pricing.discountPercent),
                }]
                : undefined,
        });

        return {
            sessionId: session.id,
            url: session.url || '',
            plan,
        };
    }

    /**
     * Create or get a Stripe coupon for regional discount
     * @param region - Region code (IN, PK)
     * @param discountPercent - Discount percentage
     * @returns Stripe coupon ID
     */
    private createRegionalDiscountCoupon(region: string, discountPercent: number): string {
        const couponId = `regional_${region}_${discountPercent}`;

        if (!this.isStripeConfigured()) {
            // Development mode: return mock coupon
            return couponId;
        }

        // In production, you would check/create the coupon in Stripe
        return couponId;
    }

    /**
     * Handle Stripe webhook events
     * @param payload - Raw webhook payload
     * @param signature - Stripe signature header
     * @returns Processed event type
     */
    async handleStripeWebhook(payload: Buffer, signature: string): Promise<string> {
        if (!this.isStripeConfigured()) {
            console.warn('Stripe is not configured. Webhook handling skipped.');
            return 'skipped';
        }

        const stripeClient = await this.getStripeClient();

        let event: any;

        try {
            event = stripeClient.webhooks.constructEvent(
                payload.toString(),
                signature,
                this.stripeWebhookSecret!
            );
        } catch (error) {
            console.error('Webhook signature verification failed:', error);
            throw new Error('Invalid webhook signature');
        }

        console.log(`Received Stripe webhook: ${event.type}`);

        // Route to appropriate handler
        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutSessionCompleted(event);
                return 'checkout.session.completed';

            case 'customer.subscription.created':
                await this.handleSubscriptionCreated(event);
                return 'customer.subscription.created';

            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event);
                return 'customer.subscription.updated';

            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event);
                return 'customer.subscription.deleted';

            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event);
                return 'invoice.payment_failed';

            default:
                console.log(`Unhandled webhook event: ${event.type}`);
                return 'unhandled';
        }
    }

    /**
     * Handle checkout.session.completed event
     * Creates subscription record and updates user plan
     */
    private async handleCheckoutSessionCompleted(event: StripeWebhookEvent): Promise<void> {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;

        if (!userId || !plan) {
            console.error('Missing user_id or plan in session metadata');
            return;
        }

        const pool = getPool();

        // Update user plan
        await pool.query(
            `UPDATE users SET plan = $1 WHERE id = $2`,
            [plan, userId]
        );

        // Update Stripe IDs if present
        if (session.customer) {
            await this.updateUserStripeIds(userId, session.customer as string, session.subscription as string);
        }

        // Reset monthly quota for new plan
        await this.resetUserQuotaForPlan(userId, plan);

        console.log(`User ${userId} upgraded to ${plan} plan`);
    }

    /**
     * Handle customer.subscription.created event
     * Updates subscription record
     */
    private async handleSubscriptionCreated(event: StripeWebhookEvent): Promise<void> {
        const subscription = event.data.object;

        // Find user by Stripe customer ID
        const pool = getPool();
        const stripeCustomerId = subscription.customer as string;

        // Query by decrypted customer ID using pgp_sym_decrypt
        const userResult = await pool.query(
            `SELECT id FROM users
             WHERE pgp_sym_decrypt(stripe_customer_id_encrypted, $1) = $2`,
            [process.env.ENCRYPTION_KEY, stripeCustomerId]
        );

        if (userResult.rows.length === 0) {
            console.warn('User not found for subscription');
            return;
        }

        const userId = userResult.rows[0].id;

        // Extract plan from subscription items
        const plan = this.extractPlanFromSubscription(subscription);

        if (plan) {
            await pool.query(
                `UPDATE users SET plan = $1 WHERE id = $2`,
                [plan, userId]
            );
        }

        console.log(`Subscription created for user ${userId}: ${plan}`);
    }

    /**
     * Handle subscription updated event
     * Updates plan if changed
     */
    private async handleSubscriptionUpdated(event: StripeWebhookEvent): Promise<void> {
        const subscription = event.data.object;

        if (subscription.cancel_at_period_end) {
            // Plan will downgrade at period end
            const pool = getPool();
            const stripeCustomerId = subscription.customer as string;

            const userResult = await pool.query(
                `SELECT id FROM users
                 WHERE pgp_sym_decrypt(stripe_customer_id_encrypted, $1) = $2`,
                [process.env.ENCRYPTION_KEY, stripeCustomerId]
            );

            if (userResult.rows.length > 0) {
                const userId = userResult.rows[0].id;
                await pool.query(
                    `UPDATE users SET plan = $1 WHERE id = $2`,
                    ['starter', userId]
                );
                console.log(`User ${userId} will downgrade at period end`);
            }
        }
    }

    /**
     * Handle subscription deleted event
     */
    private async handleSubscriptionDeleted(event: StripeWebhookEvent): Promise<void> {
        const subscription = event.data.object;

        const pool = getPool();
        const stripeCustomerId = subscription.customer as string;

        const userResult = await pool.query(
            `SELECT id FROM users
             WHERE pgp_sym_decrypt(stripe_customer_id_encrypted, $1) = $2`,
            [process.env.ENCRYPTION_KEY, stripeCustomerId]
        );

        if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            await pool.query(
                `UPDATE users SET plan = 'starter', stripe_subscription_id_encrypted = NULL WHERE id = $1`,
                [userId]
            );
            console.log(`User ${userId} subscription deleted`);
        }
    }

    /**
     * Handle payment failed event
     * Initiates downgrade after grace period
     */
    private async handlePaymentFailed(event: StripeWebhookEvent): Promise<void> {
        const invoice = event.data.object;

        // Check if this is a subscription invoice
        if (!invoice.subscription) {
            return;
        }

        // Track failed payment
        const pool = getPool();
        const stripeCustomerId = invoice.customer as string;

        // Get user ID by decrypting customer ID
        const userResult = await pool.query(
            `SELECT id FROM users
             WHERE pgp_sym_decrypt(stripe_customer_id_encrypted, $1) = $2`,
            [process.env.ENCRYPTION_KEY, stripeCustomerId]
        );

        if (userResult.rows.length === 0) {
            console.warn('User not found for payment failure');
            return;
        }

        const userId = userResult.rows[0].id;

        await pool.query(
            `INSERT INTO payment_failures (invoice_id, user_id, attempt, created_at)
             VALUES ($1, $2, 1, NOW())
             ON CONFLICT DO NOTHING`,
            [invoice.id, userId]
        );

        // After 3 failures, downgrade user
        const failureCountResult = await pool.query(
            `SELECT COUNT(*) as count FROM payment_failures
             WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
            [userId]
        );

        const failureCount = parseInt(failureCountResult.rows[0].count);

        if (failureCount >= 3) {
            await pool.query(
                `UPDATE users SET plan = 'starter' WHERE id = $1`,
                [userId]
            );
            console.log(`User ${userId} downgraded after 3 payment failures`);
        }
    }

    /**
     * Update user's Stripe IDs
     */
    private async updateUserStripeIds(userId: string, customerId: string, subscriptionId: string): Promise<void> {
        const pool = getPool();

        // Encrypt Stripe IDs using pgp_sym_encrypt (same as users table)
        const customerIdEncrypted = `pgp_sym_encrypt('${customerId}', $1)`;
        const subscriptionIdEncrypted = `pgp_sym_encrypt('${subscriptionId}', $1)`;

        await pool.query(
            `UPDATE users SET
             stripe_customer_id_encrypted = ${customerIdEncrypted},
             stripe_subscription_id_encrypted = ${subscriptionIdEncrypted}
             WHERE id = $2`,
            [process.env.ENCRYPTION_KEY, userId]
        );
    }

    /**
     * Reset user's quota based on new plan
     */
    private async resetUserQuotaForPlan(userId: string, plan: string): Promise<void> {
        const pool = getPool();
        const now = new Date();
        const month = now.toISOString().slice(0, 7); // "2026-04"

        // Calculate quota limit based on plan
        const quotaLimits: Record<string, number> = {
            free_trial: 10,
            starter: 50,
            pro: 200,
            enterprise: 10000,
        };

        const limit = quotaLimits[plan] || 10;

        // Create or update quota ledger
        await pool.query(
            `INSERT INTO quota_ledger (user_id, month, scans_used, scans_limit, reset_at, plan_at_creation)
             VALUES ($1, $2, 0, $3, date_trunc('month', $4::date) + interval '1 month', $5)
             ON CONFLICT (user_id, month) DO UPDATE SET
             scans_limit = $3,
             plan_at_creation = $5`,
            [userId, month, limit, now, plan]
        );
    }

    /**
     * Extract plan from subscription items
     */
    private extractPlanFromSubscription(subscription: any): string | null {
        const items = subscription.items?.data;
        if (!items || items.length === 0) {
            return null;
        }

        const priceId = items[0].price.id;

        // Reverse lookup price ID to plan
        for (const [plan, price] of Object.entries(STRIPE_PRICE_IDS)) {
            if (price === priceId) {
                return plan;
            }
        }

        return null;
    }

    /**
     * Get subscription details for a user
     * @param userId - User ID
     * @returns Subscription details or null
     */
    async getSubscriptionDetails(userId: string): Promise<any> {
        const pool = getPool();

        const result = await pool.query(
            `SELECT
                plan,
                stripe_subscription_id_encrypted,
                created_at as subscription_started
             FROM users
             WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return null;
        }

        const user = result.rows[0];

        // Decrypt subscription ID if present
        let subscriptionId: string | null = null;
        if (user.stripe_subscription_id_encrypted) {
            try {
                const decrypted = await pool.query(
                    `SELECT pgp_sym_decrypt(stripe_subscription_id_encrypted, $1) as subscription_id`,
                    [process.env.ENCRYPTION_KEY]
                );
                subscriptionId = decrypted.rows[0]?.subscription_id;
            } catch (error) {
                console.error('Failed to decrypt subscription ID:', error);
            }
        }

        return {
            plan: user.plan,
            subscriptionId,
            startedAt: user.subscription_started,
        };
    }

    /**
     * Cancel subscription (immediately or at period end)
     * @param userId - User ID
     * @param immediately - Cancel immediately or at period end
     */
    async cancelSubscription(userId: string, immediately: boolean = false): Promise<void> {
        const pool = getPool();

        // Get subscription ID
        const result = await pool.query(
            'SELECT stripe_subscription_id_encrypted FROM users WHERE id = $1',
            [userId]
        );

        if (result.rows.length === 0 || !result.rows[0].stripe_subscription_id_encrypted) {
            throw new Error('No active subscription found');
        }

        if (!this.isStripeConfigured()) {
            // Development mode: just update local state
            await pool.query(
                `UPDATE users SET plan = 'starter' WHERE id = $1`,
                [userId]
            );
            return;
        }

        const stripeClient = await this.getStripeClient();

        try {
            // Decrypt subscription ID
            const decrypted = await pool.query(
                `SELECT pgp_sym_decrypt(stripe_subscription_id_encrypted, $1) as subscription_id`,
                [process.env.ENCRYPTION_KEY]
            );
            const subscriptionId = decrypted.rows[0]?.subscription_id;

            if (subscriptionId) {
                if (immediately) {
                    await stripeClient.subscriptions.cancel(subscriptionId);
                } else {
                    await stripeClient.subscriptions.update(subscriptionId, {
                        cancel_at_period_end: true,
                    });
                }
            }

            // Update local plan
            await pool.query(
                `UPDATE users SET plan = 'starter' WHERE id = $1`,
                [userId]
            );

        } catch (error) {
            console.error('Failed to cancel subscription:', error);
            throw new Error('Failed to cancel subscription');
        }
    }
}

// Export singleton instance
export const billingService = new BillingService();

export default billingService;
