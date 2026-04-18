/**
 * Swagger configuration for VibeScan API
 * Only enabled in development mode
 */

import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

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
} as const;

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
} as const;

/**
 * Register Swagger routes
 */
export async function registerSwagger(app: FastifyInstance): Promise<void> {
    try {
        console.log('Registering fastifySwagger...');
        const swaggerPlugin = (fastifySwagger as any).default || fastifySwagger;
        await app.register(swaggerPlugin, swaggerOptions);
        console.log('✓ fastifySwagger registered');
        
        console.log('Registering fastifySwaggerUi...');
        const swaggerUiPlugin = (fastifySwaggerUi as any).default || fastifySwaggerUi;
        await app.register(swaggerUiPlugin, swaggerUiOptions);
        console.log('✓ fastifySwaggerUi registered');
        
        console.log('✓ Swagger documentation registered at /docs');
    } catch (error) {
        console.error('✗ Failed to register Swagger:', (error as Error).message);
    }
}
