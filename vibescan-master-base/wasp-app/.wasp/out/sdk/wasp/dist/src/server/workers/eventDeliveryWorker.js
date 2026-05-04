import * as http from 'http';
import * as https from 'https';
import { PrismaClient } from '@prisma/client';
import { signWebhookPayload } from '../services/webhookSigner.js';
import { validateWebhookTargetUrl } from '../../shared/webhookTarget';
import { buildEventDeliveryRequest } from '../services/eventDestinationService.js';
import { isProductionEnvironment } from '../config/env.js';
const prisma = new PrismaClient();
const DELIVERY_TIMEOUT = 30000;
const MAX_RETRIES = 5;
function safeTarget(targetUrl) {
    try {
        return new URL(targetUrl).hostname;
    }
    catch {
        return 'invalid-url';
    }
}
function httpRequest(url, options, data) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        const req = client.request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                resolve({
                    status: res.statusCode || 500,
                    body: body.substring(0, 2000),
                });
            });
        });
        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });
        req.setTimeout(DELIVERY_TIMEOUT);
        req.write(data);
        req.end();
    });
}
function calculateNextRetry(attemptNumber) {
    const delays = [1000, 2000, 4000, 8000, 16000, 32000];
    const delay = delays[Math.min(attemptNumber, delays.length - 1)];
    return new Date(Date.now() + delay);
}
export async function eventDeliveryWorker(job) {
    const { deliveryId } = job.data;
    const attemptNumber = (job.attemptsMade || 0) + 1;
    const delivery = await prisma.eventDelivery.findUnique({
        where: { id: deliveryId },
        include: {
            eventOutbox: true,
            subscription: true,
        },
    });
    if (!delivery) {
        throw new Error(`Event delivery not found: ${deliveryId}`);
    }
    const request = buildEventDeliveryRequest(delivery.eventOutbox, delivery.subscription);
    const targetUrl = request.url;
    const targetHost = safeTarget(targetUrl);
    let httpStatus = 500;
    let responseBody = '';
    let durationMs = 0;
    try {
        await validateWebhookTargetUrl(targetUrl, {
            allowHttp: !isProductionEnvironment(),
            allowLocalHttp: !isProductionEnvironment(),
        });
        const headers = {
            ...request.headers,
            'X-Vibescan-Timestamp': new Date().toISOString(),
        };
        if (delivery.subscription.signingSecretEncrypted) {
            const { signature } = signWebhookPayload(request.body, delivery.subscription.signingSecretEncrypted);
            headers['X-Vibescan-Signature'] = `sha256=${signature}`;
        }
        const startedAt = Date.now();
        const response = await httpRequest(targetUrl, { method: 'POST', headers }, request.body);
        durationMs = Date.now() - startedAt;
        httpStatus = response.status;
        responseBody = response.body;
    }
    catch (error) {
        httpStatus = 0;
        responseBody = error instanceof Error ? error.message : String(error);
    }
    const status = httpStatus >= 200 && httpStatus < 300 ? 'delivered' : 'failed';
    await prisma.eventDelivery.update({
        where: { id: delivery.id },
        data: {
            attemptNumber,
            httpStatus,
            responseBody,
            durationMs,
            status,
            deliveredAt: status === 'delivered' ? new Date() : null,
            nextRetryAt: status === 'failed' && attemptNumber < MAX_RETRIES
                ? calculateNextRetry(attemptNumber)
                : null,
            errorMessage: status === 'failed' ? responseBody : null,
        },
    });
    if (status === 'delivered') {
        return { success: true, status: httpStatus };
    }
    if (attemptNumber >= MAX_RETRIES) {
        await prisma.eventDelivery.update({
            where: { id: delivery.id },
            data: {
                status: 'exhausted',
            },
        });
        throw new Error(`Delivery failed after ${MAX_RETRIES} attempts to ${targetHost}`);
    }
    throw new Error(`Delivery failed with status ${httpStatus} to ${targetHost}`);
}
//# sourceMappingURL=eventDeliveryWorker.js.map