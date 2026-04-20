import swaggerJsdoc from 'swagger-jsdoc';
import type { PaymentsWebhook } from 'wasp/server/api';
import { schemas } from './swagger/schemas';

/**
 * Swagger/OpenAPI handlers for VibeScan API documentation
 * Exposes GET /docs (Swagger UI) and GET /docs/swagger.json (OpenAPI spec)
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
        url: process.env.WASP_SERVER_URL || 'http://192.168.1.17:3555',
        description: 'Development server',
      },
      {
        url: 'https://app.vibescan.app',
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
          description: 'API Key (format: vsk_...; legacy sk_live_... still accepted) generated from /api/v1/api-keys',
        },
      },
      schemas,
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
      {
        name: 'Settings',
        description: 'Profile and notification settings',
      },
      {
        name: 'Billing',
        description: 'Billing and payment operations',
      },
    ],
  },
  apis: [
    './src/auth/**/*.ts',
    './src/apiKeys/**/*.ts',
    './src/scans/**/*.ts',
    './src/server/operations/**/*.ts',
    './src/payment/**/*.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * GET /docs/swagger.json - Returns OpenAPI specification as JSON
 */
export const getSwaggerJson: PaymentsWebhook = async (
  _request: any,
  response: any,
  context: any,
) => {
  response.setHeader('Content-Type', 'application/json');
  response.send(swaggerSpec);
};

/**
 * GET /docs - Returns Swagger UI HTML page
 */
export const getSwaggerUI: PaymentsWebhook = async (
  _request: any,
  response: any,
  context: any,
) => {
  // Serve Swagger UI HTML with CDN resources
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VibeScan API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
  <style>
    html {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *,
    *:before,
    *:after {
      box-sizing: inherit;
    }
    body {
      margin: 0;
      background: #fafafa;
    }
    .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/docs/swagger.json',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout',
      deepLinking: true,
      showExtensions: true,
    });
  </script>
</body>
</html>
  `;
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.send(html);
};
