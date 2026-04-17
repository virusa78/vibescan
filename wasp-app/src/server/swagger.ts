import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

/**
 * Swagger/OpenAPI documentation configuration for VibeScan API
 * This setup provides API documentation at http://localhost:3001/docs
 */

const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'VibeScan API',
      version: '1.0.0',
      description: 'Vulnerability scanning platform API - Submit scans, manage API keys, view reports',
      contact: {
        name: 'VibeScan Support',
        url: 'https://vibescan.app',
      },
    },
    servers: [
      {
        url: process.env.WASP_WEB_CLIENT_URL || 'http://localhost:3001',
        description: 'Development server',
      },
      {
        url: 'https://api.vibescan.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token from /auth/login (15 min expiry)',
        },
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API Key (format: vsk_xxxxx) generated from /api-keys',
        },
      },
    },
    security: [
      { bearerAuth: [] },
      { apiKeyAuth: [] },
    ],
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and authorization',
      },
      {
        name: 'API Keys',
        description: 'Manage API keys for programmatic access',
      },
      {
        name: 'Scans',
        description: 'Submit and manage vulnerability scans',
      },
      {
        name: 'Reports',
        description: 'Retrieve scan reports and results',
      },
      {
        name: 'Webhooks',
        description: 'Configure and manage webhooks',
      },
      {
        name: 'Dashboard',
        description: 'Dashboard analytics and metrics',
      },
    ],
  },
  apis: [
    './src/auth/**/*.ts',
    './src/apiKeys/**/*.ts',
    './src/scans/**/*.ts',
    './src/payment/**/*.ts',
    './src/server/operations/dashboard/**/*.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Express middleware to serve Swagger UI
 * Usage: app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerSpec))
 */
export const swaggerUiMiddleware = swaggerUi.serve;
export const swaggerUiSetup = swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'VibeScan API Documentation',
  swaggerOptions: {
    url: '/docs/swagger.json',
  },
});

export const swaggerSpecHandler = (_req: any, res: any) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
};

