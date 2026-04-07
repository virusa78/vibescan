/**
 * Prometheus Metrics Middleware for Fastify
 *
 * Automatically collects metrics for HTTP requests
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import { observeHttpRequestDuration, incrementHttpRequestCounter } from './metrics.js';

// Type aliases for convenience
type Request = FastifyRequest;
type Reply = FastifyReply;

/**
 * Metrics middleware for Fastify
 */
export async function metricsMiddleware(request: any, reply: any, done: any): Promise<void> {
    const startTime = Date.now();

    // Store start time on request
    request.metrics = {
        startTime,
        path: request.routerPath || request.url,
        method: request.method,
    };

    // Hook into onSend to calculate duration
    reply.onSend((req: any, res: any, payload: any) => {
        const durationSeconds = (Date.now() - startTime) / 1000;
        const statusCode = res.statusCode || 200;

        // Increment request counter
        incrementHttpRequestCounter(
            req.metrics.method,
            req.metrics.path,
            statusCode
        );

        // Observe request duration
        observeHttpRequestDuration(
            req.metrics.method,
            req.metrics.path,
            statusCode,
            durationSeconds
        );
    });

    done();
}

/**
 * Metrics endpoint handler
 * Returns all collected metrics in Prometheus format
 */
export async function metricsEndpoint(request: Request, reply: Reply): Promise<void> {
    const { collectMetrics } = await import('./metrics.js');

    try {
        const metrics = await collectMetrics();
        reply.header('Content-Type', 'text/plain; version=0.0.4');
        reply.code(200).send(metrics);
    } catch (error) {
        console.error('Error collecting metrics:', error);
        reply.code(500).send({ error: 'Failed to collect metrics' });
    }
}

export default {
    metricsMiddleware,
    metricsEndpoint,
};
