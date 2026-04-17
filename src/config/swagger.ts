/**
 * Swagger configuration for VibeScan API
 * Only enabled in development mode
 */

import { FastifyInstance } from 'fastify';

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
    try {
        console.log('Loading Swagger modules...');
        const fastifySwagger = await import('@fastify/swagger');
        const fastifySwaggerUi = await import('@fastify/swagger-ui');
        console.log('✓ Swagger modules loaded');
        
        console.log('Registering fastifySwagger...');
        await app.register(fastifySwagger.default || fastifySwagger, swaggerOptions);
        console.log('✓ fastifySwagger registered');
        
        console.log('Registering fastifySwaggerUi...');
        await app.register(fastifySwaggerUi.default || fastifySwaggerUi, swaggerUiOptions);
        console.log('✓ fastifySwaggerUi registered');
        
        console.log('✓ Swagger documentation registered at /docs');
    } catch (error) {
        console.error('✗ Failed to register Swagger:', (error as Error).message);
    }
}
