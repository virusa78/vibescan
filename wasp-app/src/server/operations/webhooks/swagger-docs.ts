/**
 * Swagger documentation for Webhooks operations
 */

export const webhooksPaths = {
  '/api/v1/webhooks': {
    post: {
      summary: 'Create a new webhook',
      description: 'Configure a webhook endpoint for receiving scan notifications',
      tags: ['Webhooks'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['url'],
              properties: {
                url: {
                  type: 'string',
                  format: 'url',
                  description: 'HTTPS URL to receive webhook events',
                },
                events: {
                  type: 'array',
                  items: { type: 'string' },
                  default: ['scan.completed'],
                  description: 'Events to subscribe to',
                },
                active: {
                  type: 'boolean',
                  default: true,
                  description: 'Whether webhook is active',
                },
              },
            },
          },
        },
      },
      responses: {
        201: {
          description: 'Webhook created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  url: { type: 'string' },
                  events: { type: 'array', items: { type: 'string' } },
                  active: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        400: { description: 'Invalid request body' },
        401: { description: 'Unauthorized' },
      },
    },

    get: {
      summary: 'List webhooks',
      description: 'Get all webhooks configured for the authenticated user',
      tags: ['Webhooks'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      responses: {
        200: {
          description: 'List of webhooks',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    url: { type: 'string' },
                    events: { type: 'array' },
                    active: { type: 'boolean' },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
      },
    },
  },

  '/api/v1/webhooks/{webhookId}': {
    get: {
      summary: 'Get webhook details',
      description: 'Retrieve details of a specific webhook including delivery history',
      tags: ['Webhooks'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'webhookId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Webhook details',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  url: { type: 'string' },
                  events: { type: 'array' },
                  active: { type: 'boolean' },
                  createdAt: { type: 'string' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Webhook not found' },
      },
    },

    patch: {
      summary: 'Update webhook',
      description: 'Update webhook configuration (URL, events, active status)',
      tags: ['Webhooks'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'webhookId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                url: { type: 'string', format: 'url' },
                events: { type: 'array', items: { type: 'string' } },
                active: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Webhook updated' },
        401: { description: 'Unauthorized' },
        404: { description: 'Webhook not found' },
      },
    },

    delete: {
      summary: 'Delete webhook',
      description: 'Remove a webhook endpoint',
      tags: ['Webhooks'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'webhookId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: { description: 'Webhook deleted' },
        401: { description: 'Unauthorized' },
        404: { description: 'Webhook not found' },
      },
    },
  },
};

export const webhooksSchemas = {
  Webhook: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      url: { type: 'string' },
      events: { type: 'array', items: { type: 'string' } },
      active: { type: 'boolean' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },

  WebhookEvent: {
    type: 'string',
    enum: ['scan.completed', 'scan.failed', 'scan.started', 'report.generated'],
    description: 'Types of events webhooks can subscribe to',
  },
};
