/**
 * Swagger configuration for VibeScan API
 * Only enabled in development mode
 */

import { FastifyInstance } from 'fastify';

// Only import Swagger in development
let fastifySwagger: any;

async function loadSwaggerModules() {
    // Fastify-swagger v4 has compatibility issues with Fastify v4
    // Skip loading Swagger for now
    console.log('Swagger disabled due to Fastify v4 compatibility issues');
}

// Initialize Swagger modules
loadSwaggerModules();

/**
 * Swagger options
 */
export const swaggerOptions = {
    exposeRoute: true,
    swagger: {
        info: {
            title: 'VibeScan API',
            description: 'Dual-scanner vulnerability scanning platform API',
            version: '0.1.0',
        },
        servers: [
            {
                url: 'http://localhost:3000',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
                apiKeyAuth: {
                    type: 'apiKey',
                    in: 'header',
                    name: 'X-API-Key',
                },
            },
        },
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'API Keys', description: 'API key management' },
            { name: 'Scans', description: 'Vulnerability scanning operations' },
            { name: 'Reports', description: 'Scan reports and results' },
            { name: 'Webhooks', description: 'Webhook configuration and delivery' },
            { name: 'GitHub', description: 'GitHub App integration' },
            { name: 'Billing', description: 'Payment and subscription management' },
        ],
    },
    uiConfig: {
        deepLinking: true,
        displayRequestDuration: true,
        docExpansion: 'full',
        maxDisplayedTags: 10,
    },
};

/**
 * Register Swagger routes
 */
export async function registerSwagger(app: FastifyInstance): Promise<void> {
    if (!fastifySwagger) {
        console.log('Swagger not available - skipping');
        return;
    }

    try {
        await app.register(fastifySwagger.default, swaggerOptions);
        console.log('Swagger documentation registered at /docs');
    } catch (error) {
        console.error('Failed to register Swagger:', error);
    }
}
