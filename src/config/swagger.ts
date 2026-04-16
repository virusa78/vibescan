/**
 * Swagger configuration for VibeScan API
 * Only enabled in development mode
 */

import { FastifyInstance } from 'fastify';

let fastifySwagger: any;
let fastifySwaggerUi: any;

async function loadSwaggerModules() {
    try {
        fastifySwagger = await import('@fastify/swagger');
        fastifySwaggerUi = await import('@fastify/swagger-ui');
    } catch (error) {
        console.log('Swagger modules not available - skipping docs registration');
    }
}

// Initialize Swagger modules
loadSwaggerModules();

/**
 * Swagger options
 */
export const swaggerOptions = {
    openapi: {
        info: {
            title: 'VibeScan API',
            description: 'Dual-scanner vulnerability scanning platform API',
            version: '0.1.0',
        },
        servers: [
            {
                url: 'http://localhost:3001',
                description: 'Development backend server',
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
};

export const swaggerUiOptions = {
    routePrefix: '/docs',
    uiConfig: {
        deepLinking: true,
        displayRequestDuration: true,
        docExpansion: 'full',
        maxDisplayedTags: 10,
    },
    staticCSP: true,
    transformSpecificationClone: true,
};

/**
 * Register Swagger routes
 */
export async function registerSwagger(app: FastifyInstance): Promise<void> {
    if (!fastifySwagger || !fastifySwaggerUi) {
        console.log('Swagger not available - skipping');
        return;
    }

    try {
        await app.register(fastifySwagger.default || fastifySwagger, swaggerOptions);
        await app.register(fastifySwaggerUi.default || fastifySwaggerUi, swaggerUiOptions);
        console.log('Swagger documentation registered at /docs');
    } catch (error) {
        console.error('Failed to register Swagger:', error);
    }
}
