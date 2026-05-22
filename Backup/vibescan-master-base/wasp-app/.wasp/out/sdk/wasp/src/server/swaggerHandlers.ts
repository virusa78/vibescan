import type { PaymentsWebhook } from 'wasp/server/api';
import type { Response } from 'express';
import { generateOpenApiSpec } from './swagger/openapiSpec';

/**
 * Swagger/OpenAPI handlers for VibeScan API documentation
 * Exposes GET /docs (Swagger UI) and GET /docs/swagger.json (OpenAPI spec)
 */

type SwaggerSpec = Awaited<ReturnType<typeof generateOpenApiSpec>>;

type SwaggerResponse = Pick<Response, 'setHeader' | 'send' | 'statusCode'>;

let swaggerSpecPromise: Promise<SwaggerSpec> | null = null;

async function getSwaggerSpec() {
  if (!swaggerSpecPromise) {
    swaggerSpecPromise = generateOpenApiSpec();
  }

  return swaggerSpecPromise;
}

/**
 * GET /docs/swagger.json - Returns OpenAPI specification as JSON
 */
export const getSwaggerJson: PaymentsWebhook = async (
  _request: unknown,
  response: SwaggerResponse,
  _context: unknown,
) => {
  try {
    response.setHeader('Content-Type', 'application/json');
    response.send(await getSwaggerSpec());
  } catch (error) {
    response.statusCode = 500;
    response.send({
      error: 'swagger_generation_failed',
      message: error instanceof Error ? error.message : 'Unknown swagger generation error',
    });
  }
};

/**
 * GET /docs - Returns Swagger UI HTML page
 */
export const getSwaggerUI: PaymentsWebhook = async (
  _request: unknown,
  response: SwaggerResponse,
  _context: unknown,
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
