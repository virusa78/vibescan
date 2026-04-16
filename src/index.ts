/**
 * VibeScan - Main Application Entry Point
 *
 * A SaaS vulnerability scanning platform with dual-scanner architecture
 * (Grype free + Codescoring/BlackDuck enterprise).
 */

import fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Readable } from 'stream';
import { ListBucketsCommand } from '@aws-sdk/client-s3';
import { runMigrations } from './database/migrate.js';
import { getPool } from './database/client.js';
import { ensureBucketsExist, getS3Client, closeS3Connection, setupLifecyclePolicies } from './s3/client.js';
import { getRedisClient, closeRedisConnection } from './redis/client.js';
import { closeAllQueues, getFreeScanQueue, getEnterpriseScanQueue, getWebhookDeliveryQueue, getReportGenerationQueue } from './queues/config.js';
import config from './config/index.js';
import { getWorkerConfigs, createWorker } from './queues/config.js';
import { registerSwagger } from './config/swagger.js';
import { getPlatformOwnedAreas, isOpenSaasModeEnabled, isPlatformOwned } from './platform/boundaries.js';

// Create Fastify instance
const app = fastify({
    logger: {
        level: config.NODE_ENV === 'production' ? 'info' : 'debug'
    }
});

// Register plugins
await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-VibeScan-Signature']
});

await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX_REQUESTS,
    timeWindow: config.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (req: any) => {
        return req.headers['x-forwarded-for'] || req.ip || req.connection?.remoteAddress;
    }
});

// Health check endpoint
app.get('/health', async (request, reply) => {
    const health = {
        status: 'healthy' as string,
        timestamp: new Date().toISOString(),
        services: {
            database: 'unknown' as string,
            redis: 'unknown' as string,
            s3: 'unknown' as string,
            queues: {} as { free_scan: string; enterprise_scan: string; webhook_delivery: string; report_generation: string } | string
        }
    };

    // Check database
    try {
        const pool = getPool();
        await pool.query('SELECT 1');
        health.services.database = 'ok';
    } catch (error) {
        health.services.database = 'error';
        health.status = 'degraded';
    }

    // Check Redis
    try {
        const redis = await getRedisClient();
        await redis.ping();
        health.services.redis = 'ok';
    } catch (error) {
        health.services.redis = 'error';
        health.status = 'degraded';
    }

    // Check S3
    try {
        const s3 = await getS3Client();
        await s3.send(new ListBucketsCommand({}));
        health.services.s3 = 'ok';
    } catch (error) {
        health.services.s3 = 'error';
        health.status = 'degraded';
    }

    // Check queues
    try {
        const freeQueue = await getFreeScanQueue();
        const enterpriseQueue = await getEnterpriseScanQueue();
        const webhookQueue = await getWebhookDeliveryQueue();
        const reportQueue = await getReportGenerationQueue();

        // Use queue.getName() instead of .key for BullMQ v3
        health.services.queues = {
            free_scan: freeQueue.name,
            enterprise_scan: enterpriseQueue.name,
            webhook_delivery: webhookQueue.name,
            report_generation: reportQueue.name
        };
    } catch (error) {
        health.services.queues = 'error';
        health.status = 'degraded';
    }

    return reply.send(health);
});

// Root endpoint
app.get('/', async (request, reply) => {
    return {
        name: 'VibeScan',
        version: '0.1.0',
        description: 'Dual-scanner vulnerability scanning platform',
        endpoints: {
            auth: '/auth/*',
            scans: '/scans/*',
            reports: '/reports/*',
            webhooks: '/webhooks/*',
            github: '/github/*',
            billing: '/billing/*',
            remediation: '/remediation/*'
        }
    };
});

// Import handlers
import * as authHandlers from './handlers/authHandlers.js';
import * as apiKeyHandlers from './handlers/apiKeyHandlers.js';
import * as scanHandlers from './handlers/scanHandlers.js';
import * as reportHandlers from './handlers/reportHandlers.js';
import * as billingHandlers from './handlers/billingHandlers.js';
import * as githubHandlers from './handlers/githubHandlers.js';
import * as settingsHandlers from './handlers/settingsHandlers.js';
import * as cveRemediationHandlers from './handlers/cveRemediationHandlers.js';
import * as aiFixPromptHandlers from './handlers/aiFixPromptHandlers.js';
import * as securityScoreHandlers from './handlers/securityScoreHandlers.js';
import * as middleware from './middleware/apiGateway.js';

// JWT verification hook - use preHandler to run before all route handlers
app.addHook('preHandler', async (request: any, reply: any) => {
    console.log(`preHandler called for ${request.method} ${request.url}`);
    const authorizationHeader = request.headers['authorization'];
    console.log(`Authorization header present: ${!!authorizationHeader}`);
    if (authorizationHeader) {
        console.log(`Authorization header value: ${authorizationHeader.substring(0, 20)}...`);
    }

    if (authorizationHeader && authorizationHeader.startsWith('Bearer ')) {
        const token = authorizationHeader.substring(7);
        try {
            const jwt = await import('jsonwebtoken');
            const decoded = (jwt.default as any).verify(token, config.JWT_SECRET);
            request.user = decoded;
            console.log('JWT verified for user:', decoded.userId, 'email:', decoded.email);
        } catch (error) {
            console.log('JWT verification failed:', (error as Error).message);
            // Token is invalid, continue without authentication
        }
    }
});

app.addHook('preParsing', (request: any, reply: any, payload: any, done: any) => {
    const rawBodyRoutes = new Set(['/billing/webhook', '/github/webhook', '/v1/github/webhook']);
    if (request.method !== 'POST' || !rawBodyRoutes.has(request.url)) {
        done(null, payload);
        return;
    }

    const chunks: Buffer[] = [];
    payload.on('data', (chunk: Buffer) => {
        chunks.push(Buffer.from(chunk));
    });
    payload.on('end', () => {
        request.rawBody = Buffer.concat(chunks);
        done(null, Readable.from(request.rawBody));
    });
    payload.on('error', (error: Error) => {
        done(error);
    });
});

// Register API routes
// Ownership reference: src/platform/boundaries.ts -> PLATFORM_ROUTE_OWNERSHIP.
// When OPENSAAS_MODE=false (default), no areas are delegated.
if (!isPlatformOwned('auth')) {
    app.post('/auth/register', authHandlers.registerHandler);
    app.post('/auth/login', authHandlers.loginHandler);
    app.post('/auth/refresh', authHandlers.refreshHandler);
    app.post('/auth/logout', authHandlers.logoutHandler);
    app.get('/auth/me', authHandlers.getMeHandler);
    app.get('/v1/me', authHandlers.getMeHandler);
    app.patch('/v1/me', settingsHandlers.updateProfileHandler);
    app.post('/v1/me/email/change', authHandlers.requestEmailChangeHandler);
    app.post('/v1/me/email/verify', authHandlers.verifyEmailChangeHandler);
}

if (!isPlatformOwned('api_keys')) {
    app.post('/api-keys', apiKeyHandlers.generateApiKeyHandler);
    app.get('/api-keys', apiKeyHandlers.listApiKeysHandler);
    app.delete('/api-keys/:id', apiKeyHandlers.revokeApiKeyHandler);
    app.patch('/api-keys/:id', apiKeyHandlers.updateApiKeyHandler);
    app.post('/v1/api-keys', apiKeyHandlers.generateApiKeyHandler);
    app.get('/v1/api-keys', apiKeyHandlers.listApiKeysHandler);
    app.patch('/v1/api-keys/:id', apiKeyHandlers.updateApiKeyHandler);
    app.delete('/v1/api-keys/:id', apiKeyHandlers.revokeApiKeyHandler);
}

app.post('/scans', scanHandlers.submitScanHandler);
app.get('/scans', scanHandlers.listScansHandler);
app.get('/dashboard/summary', scanHandlers.getDashboardSummaryHandler);
app.get('/v1/dashboard/summary', scanHandlers.getDashboardSummaryHandler);
app.get('/scans/queue/priority', scanHandlers.getQueuePriorityHandler);
app.get('/scans/:id', scanHandlers.getScanStatusHandler);
app.delete('/scans/:id', scanHandlers.cancelScanHandler);
app.get('/v1/scans/queue/priority', scanHandlers.getQueuePriorityHandler);

app.get('/reports/:scanId', reportHandlers.getReportHandler);
app.post('/reports/:scanId/pdf', reportHandlers.generatePdfReportHandler);
app.get('/reports/:scanId/ci', reportHandlers.getCiDecisionHandler);
app.get('/reports/jobs/:jobId', reportHandlers.getPdfReportStatusHandler);
app.get('/v1/reports/jobs/:jobId', reportHandlers.getPdfReportStatusHandler);

if (!isPlatformOwned('billing')) {
    app.post('/billing/checkout', billingHandlers.createCheckoutHandler);
    app.get('/billing/subscription', billingHandlers.getSubscriptionHandler);
    app.post('/billing/cancel', billingHandlers.cancelSubscriptionHandler);
    app.post('/billing/webhook', billingHandlers.stripeWebhookHandler);
    app.get('/billing/regional-pricing', billingHandlers.getRegionalPricingHandler);
}

app.post('/github/webhook', githubHandlers.githubWebhookHandler);
app.post('/v1/github/webhook', githubHandlers.githubWebhookHandler);

if (!isPlatformOwned('settings')) {
    // Settings routes
    // Get all settings
    app.get('/settings', settingsHandlers.getAllSettingsHandler);

    // Profile management
    app.get('/settings/profile', settingsHandlers.getProfileHandler);
    app.patch('/settings/profile', settingsHandlers.updateProfileHandler);

    // Plan and quota
    app.get('/settings/plan', settingsHandlers.getPlanHandler);
    app.get('/settings/plan/history', settingsHandlers.getPlanHistoryHandler);
    app.get('/v1/settings/plan', settingsHandlers.getPlanHandler);
    app.get('/v1/settings/plan/history', settingsHandlers.getPlanHistoryHandler);

    // API key settings mirror is disabled when api_keys ownership is delegated.
    if (!isPlatformOwned('api_keys')) {
        app.get('/settings/api-keys', settingsHandlers.listApiKeysHandler);
        app.post('/settings/api-keys', settingsHandlers.createApiKeyHandler);
        app.delete('/settings/api-keys/:id', settingsHandlers.revokeApiKeyHandler);
    }

    // Webhooks
    app.get('/settings/webhooks', settingsHandlers.listWebhooksHandler);
    app.post('/settings/webhooks', settingsHandlers.createWebhookHandler);
    app.patch('/settings/webhooks/:id', settingsHandlers.updateWebhookHandler);
    app.delete('/settings/webhooks/:id', settingsHandlers.deleteWebhookHandler);
    app.post('/settings/webhooks/:id/test', settingsHandlers.testWebhookHandler);
    app.get('/v1/settings/webhooks', settingsHandlers.listWebhooksHandler);
    app.post('/v1/settings/webhooks', settingsHandlers.createWebhookHandler);
    app.patch('/v1/settings/webhooks/:id', settingsHandlers.updateWebhookHandler);
    app.delete('/v1/settings/webhooks/:id', settingsHandlers.deleteWebhookHandler);
    app.post('/v1/settings/webhooks/:id/test', settingsHandlers.testWebhookHandler);

    // Notifications
    app.get('/settings/notifications', settingsHandlers.getNotificationsHandler);
    app.patch('/settings/notifications', settingsHandlers.updateNotificationsHandler);
    app.get('/v1/settings/notifications', settingsHandlers.getNotificationsHandler);
    app.patch('/v1/settings/notifications', settingsHandlers.updateNotificationsHandler);

    // Security
    app.get('/settings/security', settingsHandlers.getSecurityHandler);
    app.post('/settings/security/revoke-session/:id', settingsHandlers.revokeSessionHandler);
    app.get('/settings/security/events', settingsHandlers.getSecurityEventsHandler);
    app.get('/v1/settings/security/events', settingsHandlers.getSecurityEventsHandler);

    // Regional settings
    app.get('/settings/regional', settingsHandlers.getRegionalHandler);
    app.patch('/settings/regional', settingsHandlers.updateRegionalHandler);
    app.get('/v1/settings/regional', settingsHandlers.getRegionalHandler);
    app.patch('/v1/settings/regional', settingsHandlers.updateRegionalHandler);

    // Change history
    app.get('/settings/history', settingsHandlers.getHistoryHandler);
    app.get('/v1/settings/history', settingsHandlers.getHistoryHandler);
    app.get('/settings/audit-log', settingsHandlers.getAuditLogHandler);
    app.get('/v1/settings/audit-log', settingsHandlers.getAuditLogHandler);

    // Data export
    app.post('/settings/export', settingsHandlers.createExportHandler);
    app.get('/settings/export/:jobId', settingsHandlers.getExportStatusHandler);
    app.get('/settings/export/:jobId/download', settingsHandlers.downloadExportHandler);
    app.post('/v1/settings/export', settingsHandlers.createExportHandler);
    app.get('/v1/settings/export/:jobId', settingsHandlers.getExportStatusHandler);
    app.get('/v1/settings/export/:jobId/download', settingsHandlers.downloadExportHandler);
}

// CVE remediation tracking
app.post('/remediation/:scanId/items', cveRemediationHandlers.upsertRemediationItemHandler);
app.get('/remediation/:scanId/items', cveRemediationHandlers.listRemediationItemsHandler);
app.get('/remediation/:scanId/progress', cveRemediationHandlers.getRemediationProgressHandler);
app.post('/remediation/:scanId/ai-fix-prompts', aiFixPromptHandlers.generateAiFixPromptHandler);
app.get('/remediation/:scanId/ai-fix-prompts', aiFixPromptHandlers.listAiFixPromptsHandler);
app.post('/v1/remediation/:scanId/ai-fix-prompts', aiFixPromptHandlers.generateAiFixPromptHandler);
app.get('/v1/remediation/:scanId/ai-fix-prompts', aiFixPromptHandlers.listAiFixPromptsHandler);

app.get('/security/scores/trend', securityScoreHandlers.getSecurityScoreTrendHandler);
app.get('/security/scores/:scanId', securityScoreHandlers.getSecurityScoreSnapshotHandler);
app.get('/security/sla/:scanId', securityScoreHandlers.getSlaSummaryHandler);
app.get('/security/risk-acceptance/:scanId', securityScoreHandlers.listRiskAcceptancesHandler);
app.post('/security/risk-acceptance/:scanId', securityScoreHandlers.acceptRiskHandler);
app.delete('/security/risk-acceptance/:scanId/:vulnerabilityId', securityScoreHandlers.revokeRiskHandler);
app.get('/v1/security/scores/trend', securityScoreHandlers.getSecurityScoreTrendHandler);
app.get('/v1/security/scores/:scanId', securityScoreHandlers.getSecurityScoreSnapshotHandler);
app.get('/v1/security/sla/:scanId', securityScoreHandlers.getSlaSummaryHandler);
app.get('/v1/security/risk-acceptance/:scanId', securityScoreHandlers.listRiskAcceptancesHandler);
app.post('/v1/security/risk-acceptance/:scanId', securityScoreHandlers.acceptRiskHandler);
app.delete('/v1/security/risk-acceptance/:scanId/:vulnerabilityId', securityScoreHandlers.revokeRiskHandler);

// Swagger documentation (development only)
if (config.NODE_ENV !== 'production') {
    await registerSwagger(app);
}

// Error handling
app.addHook('onError', (request, reply, error, done) => {
    middleware.errorHandlingMiddleware(error, request, reply, done);
});

// Start server
async function start() {
    try {
        // Run migrations
        console.log('Running database migrations...');
        await runMigrations();

        // Initialize Redis
        console.log('Connecting to Redis...');
        await getRedisClient();

        // Initialize S3
        console.log('Initializing S3 buckets...');
        await ensureBucketsExist();
        try {
            await setupLifecyclePolicies();
        } catch (error) {
            console.log('S3: Lifecycle policy setup skipped (MinIO may not support it):', error.message);
        }

        // Initialize queues
        console.log('Initializing queues...');
        const freeQueue = await getFreeScanQueue();
        const enterpriseQueue = await getEnterpriseScanQueue();
        const webhookQueue = await getWebhookDeliveryQueue();
        const reportQueue = await getReportGenerationQueue();

        console.log(`Free scan queue: ${freeQueue.name}`);
        console.log(`Enterprise scan queue: ${enterpriseQueue.name}`);
        console.log(`Webhook delivery queue: ${webhookQueue.name}`);
        console.log(`Report generation queue: ${reportQueue.name}`);

        // Start workers
        console.log('Starting workers...');
        const workerConfigs = getWorkerConfigs();
        for (const config of workerConfigs) {
            createWorker(config).catch(console.error);
        }

        // Start server
        const port = config.PORT;
        await app.listen({ port, host: '0.0.0.0' });
        console.log(`Server listening on port ${port}`);
        console.log(`Environment: ${config.NODE_ENV}`);
        if (isOpenSaasModeEnabled()) {
            const platformAreas = [...getPlatformOwnedAreas()];
            console.log(`OpenSaaS mode enabled; platform-owned areas: ${platformAreas.join(', ') || 'none'}`);
        }

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully...');
            await app.close();
            await closeRedisConnection();
            await closeS3Connection();
            await closeAllQueues();
            process.exit(0);
        });

    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

// Start the application
start();
