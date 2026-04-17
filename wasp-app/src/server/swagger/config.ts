import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'VibeScan API',
      description: 'Vulnerability scanning and reporting API',
      version: '1.0.0',
      contact: {
        name: 'VibeScan Team',
        url: 'https://github.com/virusa78/vibescan',
      },
    },
    servers: [
      { url: 'http://localhost:3555', description: 'Development' },
      { url: 'https://api.vibescan.io', description: 'Production' },
    ],
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Bearer token',
        },
        apiKey: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
          description: 'API Key for service accounts',
        },
      },
    },
  },
};

export const swaggerUiOptions = {
  routePrefix: '/swagger',
};
