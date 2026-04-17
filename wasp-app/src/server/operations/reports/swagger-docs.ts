/**
 * Swagger documentation for Reports operations
 */

export const reportsPaths = {
  '/api/v1/reports/{scanId}': {
    get: {
      summary: 'Get full vulnerability report for a scan',
      description: 'Retrieve complete vulnerability report with findings list for a specific scan',
      tags: ['Reports'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'scanId',
          in: 'path',
          required: true,
          description: 'The ID of the scan to retrieve report for',
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Full vulnerability report',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scanId: { type: 'string' },
                  scanStatus: { type: 'string', enum: ['pending', 'scanning', 'done', 'error'] },
                  completedAt: { type: 'string', format: 'date-time', nullable: true },
                  findings: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        cve: { type: 'string' },
                        title: { type: 'string' },
                        severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
                        description: { type: 'string' },
                        source: { type: 'string' },
                        discoveredAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                  totalFindings: { type: 'number' },
                  severity: {
                    type: 'object',
                    properties: {
                      critical: { type: 'number' },
                      high: { type: 'number' },
                      medium: { type: 'number' },
                      low: { type: 'number' },
                      info: { type: 'number' },
                    },
                  },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized - missing or invalid credentials' },
        404: { description: 'Scan not found' },
        403: { description: 'Forbidden - no permission to view this scan' },
      },
    },
  },

  '/api/v1/reports/{scanId}/summary': {
    get: {
      summary: 'Get report summary (counts only)',
      description: 'Retrieve aggregated summary of vulnerabilities for a scan',
      tags: ['Reports'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'scanId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'Report summary',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scanId: { type: 'string' },
                  scanStatus: { type: 'string' },
                  totalFindings: { type: 'number' },
                  severity: {
                    type: 'object',
                    properties: {
                      critical: { type: 'number' },
                      high: { type: 'number' },
                      medium: { type: 'number' },
                      low: { type: 'number' },
                      info: { type: 'number' },
                    },
                  },
                  lastUpdated: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Scan not found' },
      },
    },
  },

  '/api/v1/reports/{scanId}/pdf': {
    post: {
      summary: 'Generate PDF report',
      description: 'Trigger PDF generation for a vulnerability report',
      tags: ['Reports'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'scanId',
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
                format: {
                  type: 'string',
                  enum: ['full', 'summary'],
                  default: 'full',
                },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'PDF generation job created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scanId: { type: 'string' },
                  jobId: { type: 'string' },
                  status: { type: 'string' },
                  estimatedTime: { type: 'string' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Scan not found' },
      },
    },
  },

  '/api/v1/reports/{scanId}/ci-decision': {
    get: {
      summary: 'Get CI pass/fail decision',
      description: 'Evaluate scan against CI policy',
      tags: ['Reports'],
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      parameters: [
        {
          name: 'scanId',
          in: 'path',
          required: true,
          schema: { type: 'string' },
        },
      ],
      responses: {
        200: {
          description: 'CI decision',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  scanId: { type: 'string' },
                  decision: { type: 'string', enum: ['pass', 'fail'] },
                  reason: { type: 'string' },
                  criticalIssues: { type: 'number' },
                },
              },
            },
          },
        },
        401: { description: 'Unauthorized' },
        404: { description: 'Scan not found' },
      },
    },
  },
};

export const reportsSchemas = {
  Report: {
    type: 'object',
    properties: {
      scanId: { type: 'string' },
      findings: { type: 'array' },
      severity: { type: 'object' },
    },
  },

  ReportSummary: {
    type: 'object',
    properties: {
      scanId: { type: 'string' },
      totalFindings: { type: 'number' },
      severity: { type: 'object' },
    },
  },

  CIDecision: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['pass', 'fail'] },
      reason: { type: 'string' },
      criticalIssues: { type: 'number' },
    },
  },
};
