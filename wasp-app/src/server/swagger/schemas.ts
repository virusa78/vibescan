// Common schemas for Swagger documentation
export const schemas = {
  // ============================================
  // Submit Scan Request/Response
  // ============================================
  SubmitScanRequest: {
    type: 'object',
    required: ['inputType', 'inputRef'],
    properties: {
      inputType: {
        type: 'string',
        enum: ['github'],
        description: 'GitHub repository scan input',
        example: 'github',
      },
      inputRef: {
        type: 'string',
        description: 'GitHub repository URL for the scan',
        example: 'https://github.com/owner/repo',
      },
    },
  },

  ScanResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Scan ID' },
      status: {
        type: 'string',
        enum: ['pending', 'scanning', 'done', 'error', 'cancelled'],
        description: 'Scan status',
      },
      created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      quota_remaining: { type: 'integer', description: 'Remaining scans in monthly quota' },
    },
  },

  // ============================================
  // List Scans Request/Response
  // ============================================
  ListScansRequest: {
    type: 'object',
    properties: {
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: 100,
        default: 25,
        description: 'Number of results per page',
      },
      offset: {
        type: 'integer',
        minimum: 0,
        default: 0,
        description: 'Number of results to skip',
      },
      status: {
        type: 'string',
        enum: ['pending', 'scanning', 'done', 'error', 'cancelled'],
        description: 'Filter by scan status (optional)',
      },
      created_from: {
        type: 'string',
        format: 'date-time',
        description: 'Filter scans created from this date (ISO 8601, optional)',
      },
      created_to: {
        type: 'string',
        format: 'date-time',
        description: 'Filter scans created until this date (ISO 8601, optional)',
      },
    },
  },

  ScanSummary: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Scan ID' },
      status: { type: 'string', enum: ['pending', 'scanning', 'done', 'error', 'cancelled'] },
      inputType: { type: 'string', enum: ['github_app'] },
      inputRef: { type: 'string', description: 'GitHub repository reference' },
      planAtSubmission: { type: 'string', enum: ['free_trial', 'starter', 'pro', 'enterprise'] },
      created_at: { type: 'string', format: 'date-time' },
      completed_at: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  ListScansResponse: {
    type: 'object',
    properties: {
      scans: {
        type: 'array',
        items: { $ref: '#/components/schemas/ScanSummary' },
      },
      total: { type: 'integer', description: 'Total number of scans matching filter' },
      has_more: { type: 'boolean', description: 'Whether there are more results to fetch' },
    },
  },

  // ============================================
  // Get Scan Detail Request/Response
  // ============================================
  ScanDetail: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      status: { type: 'string', enum: ['pending', 'scanning', 'done', 'error', 'cancelled'] },
      inputType: { type: 'string', example: 'github_app' },
      inputRef: { type: 'string', description: 'GitHub repository reference' },
      planAtSubmission: { type: 'string', enum: ['free_trial', 'starter', 'pro', 'enterprise'] },
      created_at: { type: 'string', format: 'date-time' },
      completed_at: { type: 'string', format: 'date-time', nullable: true },
      error_message: { type: 'string', nullable: true, description: 'Error details if scan failed' },
    },
  },

  ResultsSummary: {
    type: 'object',
    properties: {
      free_count: { type: 'integer', description: 'Vulnerabilities from free scanner (Grype)' },
      enterprise_count: { type: 'integer', description: 'Vulnerabilities from enterprise scanner (BlackDuck)' },
      total_count: { type: 'integer', description: 'Total vulnerabilities across both scanners' },
    },
  },

  DeltaSummary: {
    type: 'object',
    properties: {
      delta_count: { type: 'integer', description: 'Count of enterprise-only vulnerabilities' },
      delta_by_severity: {
        type: 'object',
        additionalProperties: { type: 'integer' },
        description: 'Delta vulnerabilities broken down by severity',
        example: { critical: 2, high: 5, medium: 8 },
      },
      is_locked: { type: 'boolean', description: 'Always false; delta details are always visible' },
    },
  },

  ScanDetailResponse: {
    type: 'object',
    properties: {
      scan: { $ref: '#/components/schemas/ScanDetail' },
      results_summary: { $ref: '#/components/schemas/ResultsSummary' },
      delta_summary: { $ref: '#/components/schemas/DeltaSummary' },
      status: { type: 'string', enum: ['pending', 'scanning', 'done', 'error', 'cancelled'] },
    },
  },

  // ============================================
  // Cancel Scan Request/Response
  // ============================================
  ActionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', description: 'Whether the action succeeded' },
      message: { type: 'string', description: 'Result message' },
      quota_refunded: { type: 'integer', nullable: true, description: 'Number of quota units refunded' },
    },
  },

  // ============================================
  // Get Scan Stats Request/Response
  // ============================================
  ScanStatsRequest: {
    type: 'object',
    properties: {
      time_range: {
        type: 'string',
        enum: ['7d', '30d', 'all'],
        default: '30d',
        description: 'Aggregation time range',
      },
    },
  },

  StatusBreakdown: {
    type: 'object',
    properties: {
      pending: { type: 'integer' },
      scanning: { type: 'integer' },
      done: { type: 'integer' },
      error: { type: 'integer' },
      cancelled: { type: 'integer' },
    },
  },

  SeverityBreakdown: {
    type: 'object',
    properties: {
      critical: { type: 'integer' },
      high: { type: 'integer' },
      medium: { type: 'integer' },
      low: { type: 'integer' },
      info: { type: 'integer' },
    },
  },

  ScanRate: {
    type: 'object',
    properties: {
      per_day: { type: 'number', format: 'double', description: 'Average scans per day' },
      per_week: { type: 'number', format: 'double', description: 'Average scans per week' },
    },
  },

  ScanStatsResponse: {
    type: 'object',
    properties: {
      total_scans: { type: 'integer', description: 'Total number of scans' },
      by_status: { $ref: '#/components/schemas/StatusBreakdown' },
      by_severity: { $ref: '#/components/schemas/SeverityBreakdown' },
      scan_rate: { $ref: '#/components/schemas/ScanRate' },
      time_range: { type: 'string', enum: ['7d', '30d', 'all'], description: 'Requested time range' },
    },
  },

  // ============================================
  // Error Responses
  // ============================================
  ErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', description: 'Error code' },
      message: { type: 'string', description: 'Error message' },
      details: {
        type: 'object',
        description: 'Additional error details',
      },
    },
  },

  ValidationErrorResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', enum: ['validation_error'] },
      message: { type: 'string' },
      validation_errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
  },

  QuotaExceededResponse: {
    type: 'object',
    properties: {
      error: { type: 'string', enum: ['quota_exceeded'] },
      message: { type: 'string' },
      quota_limit: { type: 'integer' },
      quota_used: { type: 'integer' },
    },
  },

  // ============================================
  // Scan Schemas (for backward compatibility)
  // ============================================
  ScanSubmission: {
    type: 'object',
    required: ['source'],
    properties: {
      source: {
        type: 'string',
        enum: ['source_zip', 'sbom_upload', 'github_app'],
        description: 'Type of scan source',
      },
      name: {
        type: 'string',
        description: 'Scan name/title',
      },
      description: {
        type: 'string',
        description: 'Scan description',
      },
    },
  },

  Scan: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Scan ID' },
      userId: { type: 'string', format: 'uuid', description: 'User who created scan' },
      status: {
        type: 'string',
        enum: ['pending', 'scanning', 'done', 'error', 'cancelled'],
      },
      name: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      completedAt: { type: 'string', format: 'date-time' },
    },
  },

  // ============================================
  // Report Schemas
  // ============================================
  Vulnerability: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Finding ID' },
      cveId: { type: 'string', description: 'CVE identifier (e.g. CVE-2024-1234)' },
      packageName: { type: 'string', description: 'Affected package name' },
      installedVersion: { type: 'string', description: 'Currently installed version' },
      severity: {
        type: 'string',
        enum: ['critical', 'high', 'medium', 'low', 'info'],
      },
      cvssScore: { type: 'number', format: 'float', description: 'CVSS v3.1 score (0-10)' },
      fixedVersion: { type: 'string', nullable: true, description: 'Version with fix (if available)' },
      description: { type: 'string', description: 'Vulnerability description' },
      source: {
        type: 'string',
        enum: ['free', 'enterprise'],
        description: 'Scanner that found this (Grype for free, BlackDuck for enterprise)',
      },
      filePath: { type: 'string', nullable: true, description: 'File path where finding was detected' },
      status: { type: 'string', description: 'Finding status' },
    },
  },

  ReportResponse: {
    type: 'object',
    properties: {
      scanId: { type: 'string', format: 'uuid' },
      status: {
        type: 'string',
        enum: ['completed', 'failed', 'partial'],
      },
      lockedView: { type: 'boolean', description: 'Always false; detailed vulnerability data is always returned' },
      severity_breakdown: { $ref: '#/components/schemas/SeverityBreakdown' },
      total_free: { type: 'integer', description: 'Total free scanner findings' },
      total_enterprise: { type: 'integer', description: 'Total enterprise scanner findings' },
      delta_count: { type: 'integer', description: 'Enterprise-only findings count' },
      vulnerabilities: {
        type: 'array',
        items: { $ref: '#/components/schemas/Vulnerability' },
        description: 'Full findings list',
      },
    },
  },

  ReportSummaryResponse: {
    type: 'object',
    properties: {
      scanId: { type: 'string', format: 'uuid' },
      totalFindings: { type: 'integer' },
      severity: {
        type: 'object',
        properties: {
          critical: { type: 'integer' },
          high: { type: 'integer' },
        },
      },
    },
  },

  PDFResponse: {
    type: 'object',
    properties: {
      scanId: { type: 'string', format: 'uuid' },
      jobId: { type: 'string', description: 'PDF generation job ID' },
      status: { type: 'string', description: 'Job status' },
      estimatedTime: { type: 'string', description: 'Estimated processing time' },
    },
  },

  CIDecisionResponse: {
    type: 'object',
    properties: {
      scanId: { type: 'string', format: 'uuid' },
      decision: {
        type: 'string',
        enum: ['pass', 'fail'],
        description: 'CI gate result',
      },
      reason: { type: 'string', description: 'Human-readable result message' },
      criticalIssues: { type: 'integer', description: 'Number of critical vulnerabilities' },
    },
  },

  // ============================================
  // Webhook Management
  // ============================================
  CreateWebhookRequest: {
    type: 'object',
    required: ['url', 'events'],
    properties: {
      url: {
        type: 'string',
        format: 'uri',
        description: 'HTTPS webhook endpoint URL',
        example: 'https://api.example.com/webhooks/vibescan',
      },
      events: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['scan_complete', 'report_ready', 'scan_failed'],
        },
        description: 'Webhook event types to subscribe to',
        example: ['scan_complete', 'report_ready'],
      },
    },
  },

  WebhookResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Webhook ID' },
      url: { type: 'string', format: 'uri', description: 'Webhook URL' },
      created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      events: {
        type: 'array',
        items: { type: 'string' },
        description: 'Subscribed event types',
      },
      secret_preview: {
        type: 'string',
        description: 'Preview of signing secret (first 8 + last 8 chars)',
        example: '12345678...abcdefgh',
      },
    },
  },

  Webhook: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      url: { type: 'string', format: 'uri' },
      created_at: { type: 'string', format: 'date-time' },
      events: {
        type: 'array',
        items: { type: 'string' },
      },
      enabled: { type: 'boolean' },
    },
  },

  WebhookListResponse: {
    type: 'object',
    properties: {
      webhooks: {
        type: 'array',
        items: { $ref: '#/components/schemas/Webhook' },
      },
    },
  },

  WebhookDeliveryStats: {
    type: 'object',
    properties: {
      total_attempts: { type: 'integer', description: 'Total delivery attempts' },
      successful: { type: 'integer', description: 'Successful deliveries' },
      failed: { type: 'integer', description: 'Failed deliveries' },
      pending: { type: 'integer', description: 'Pending deliveries' },
    },
  },

  WebhookDelivery: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      scan_id: { type: 'string', format: 'uuid' },
      status: {
        type: 'string',
        enum: ['pending', 'delivered', 'failed', 'exhausted'],
      },
      http_status: { type: 'integer', nullable: true },
      created_at: { type: 'string', format: 'date-time' },
      delivered_at: { type: 'string', format: 'date-time', nullable: true },
    },
  },

  WebhookDetailResponse: {
    type: 'object',
    properties: {
      webhook: { $ref: '#/components/schemas/Webhook' },
      delivery_stats: { $ref: '#/components/schemas/WebhookDeliveryStats' },
      last_5_deliveries: {
        type: 'array',
        items: { $ref: '#/components/schemas/WebhookDelivery' },
      },
    },
  },

  UpdateWebhookRequest: {
    type: 'object',
    properties: {
      url: { type: 'string', format: 'uri', description: 'New webhook URL (optional)' },
      events: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['scan_complete', 'report_ready', 'scan_failed'],
        },
        description: 'Updated event types (optional)',
      },
      enabled: { type: 'boolean', description: 'Enable/disable webhook (optional)' },
      rotateSecret: {
        type: 'boolean',
        description: 'Rotate the signing secret (optional)',
      },
    },
  },

  UpdateWebhookResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      url: { type: 'string', format: 'uri' },
      events: {
        type: 'array',
        items: { type: 'string' },
      },
      enabled: { type: 'boolean' },
      updated_at: { type: 'string', format: 'date-time' },
    },
  },

  // ============================================
  // Billing & Payments
  // ============================================
  PaymentPlanId: {
    type: 'string',
    enum: ['hobby', 'pro', 'credits10'],
    description: 'Payment plan identifier',
  },

  CheckoutSessionResponse: {
    type: 'object',
    properties: {
      sessionUrl: {
        type: 'string',
        nullable: true,
        description: 'Hosted checkout URL',
      },
      sessionId: { type: 'string', description: 'Checkout session ID' },
    },
  },

  CustomerPortalUrlResponse: {
    type: 'string',
    nullable: true,
    description: 'Customer portal URL (null if not available)',
  },

  // ============================================
  // Dashboard Metrics & Analytics
  // ============================================
  MetricsResponse: {
    type: 'object',
    properties: {
      total_scans: { type: 'integer', description: 'Total scans in time range' },
      scans_this_month: { type: 'integer', description: 'Scans in current calendar month' },
      total_vulnerabilities: { type: 'integer', description: 'Active vulnerabilities found' },
      avg_severity: {
        type: 'string',
        enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'],
        nullable: true,
        description: 'Average severity level',
      },
      quota_used: { type: 'integer', description: 'Monthly quota units used' },
      quota_limit: { type: 'integer', description: 'Monthly quota limit' },
      plan_tier: {
        type: 'string',
        enum: ['free_trial', 'starter', 'pro', 'enterprise'],
        description: 'Current user plan tier',
      },
      time_range: {
        type: 'string',
        enum: ['7d', '30d', 'all'],
        description: 'Requested time range',
      },
    },
  },

  RecentScan: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'Scan ID' },
      status: {
        type: 'string',
        enum: ['pending', 'scanning', 'done', 'error', 'cancelled'],
      },
      inputType: { type: 'string', enum: ['github_app', 'source_zip', 'sbom_upload', 'ci_plugin'] },
      inputRef: { type: 'string', description: 'Reference to input source' },
      planAtSubmission: { type: 'string', enum: ['free_trial', 'starter', 'pro', 'enterprise'] },
      created_at: { type: 'string', format: 'date-time', description: 'Creation timestamp' },
      completed_at: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description: 'Completion timestamp',
      },
      vulnerability_count: { type: 'integer', description: 'Number of vulnerabilities found' },
    },
  },

  RecentScansResponse: {
    type: 'object',
    properties: {
      scans: {
        type: 'array',
        items: { $ref: '#/components/schemas/RecentScan' },
        description: 'List of recent scans (up to limit)',
      },
    },
  },

  SeverityBreakdownResponse: {
    type: 'object',
    properties: {
      critical: { type: 'integer', description: 'Critical severity findings' },
      high: { type: 'integer', description: 'High severity findings' },
      medium: { type: 'integer', description: 'Medium severity findings' },
      low: { type: 'integer', description: 'Low severity findings' },
      info: { type: 'integer', description: 'Info severity findings' },
      total: { type: 'integer', description: 'Total findings' },
      time_range: {
        type: 'string',
        enum: ['7d', '30d', 'all'],
        description: 'Requested time range',
      },
    },
  },

  QuotaStatusResponse: {
    type: 'object',
    properties: {
      used: { type: 'integer', description: 'Quota units used this month' },
      limit: { type: 'integer', description: 'Monthly quota limit' },
      percentage: { type: 'integer', description: 'Usage percentage (0-100)' },
      monthly_reset_date: {
        type: 'string',
        format: 'date-time',
        description: 'Next quota reset date',
      },
      usage_trend: {
        type: 'string',
        enum: ['increasing', 'decreasing', 'stable'],
        description: 'Usage trend over last 7 days',
      },
    },
  },

  TrendBucket: {
    type: 'object',
    properties: {
      bucket_start: {
        type: 'string',
        format: 'date-time',
        description: 'Start timestamp of the aggregation bucket (UTC)',
      },
      scans: { type: 'integer', description: 'Number of scans in bucket' },
      findings: { type: 'integer', description: 'Number of active findings in bucket' },
      delta: { type: 'integer', description: 'Sum of delta findings in bucket' },
    },
  },

  TrendSeriesResponse: {
    type: 'object',
    properties: {
      time_range: {
        type: 'string',
        enum: ['7d', '30d', 'all'],
      },
      granularity: {
        type: 'string',
        enum: ['day', 'week'],
      },
      buckets: {
        type: 'array',
        items: { $ref: '#/components/schemas/TrendBucket' },
      },
      totals: {
        type: 'object',
        properties: {
          scans: { type: 'integer' },
          findings: { type: 'integer' },
          delta: { type: 'integer' },
        },
      },
    },
  },

  // ============================================
  // Profile Settings
  // ============================================
  ProfileResponse: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid', description: 'User ID' },
      name: { type: 'string', nullable: true, description: 'Display name' },
      email: { type: 'string', format: 'email', description: 'Email address' },
      region: {
        type: 'string',
        enum: ['IN', 'PK', 'OTHER'],
        description: 'User region',
      },
      plan_tier: {
        type: 'string',
        enum: ['free_trial', 'starter', 'pro', 'enterprise'],
        description: 'Current plan tier',
      },
      org_id: { type: 'string', format: 'uuid', nullable: true, description: 'Organization ID if member' },
      org_role: {
        type: 'string',
        enum: ['owner', 'member', null],
        nullable: true,
        description: 'Role in organization',
      },
    },
  },

  UpdateProfileSettingsRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255, description: 'Display name' },
      region: {
        type: 'string',
        enum: ['IN', 'PK', 'OTHER'],
        description: 'User region',
      },
      notifications_enabled: {
        type: 'boolean',
        description: 'Enable/disable notifications',
      },
    },
  },

  // ============================================
  // Notification Settings
  // ============================================
  NotificationSettingsResponse: {
    type: 'object',
    properties: {
      email_on_scan_complete: {
        type: 'boolean',
        description: 'Receive email when scan completes',
      },
      email_on_vulnerability: {
        type: 'boolean',
        description: 'Receive email on new vulnerability detection',
      },
      weekly_digest: {
        type: 'boolean',
        description: 'Receive weekly security digest',
      },
      sms_enabled: {
        type: 'boolean',
        description: 'Enable SMS notifications',
      },
    },
  },

  UpdateNotificationSettingsRequest: {
    type: 'object',
    properties: {
      email_on_scan_complete: {
        type: 'boolean',
        description: 'Receive email when scan completes',
      },
      email_on_vulnerability: {
        type: 'boolean',
        description: 'Receive email on new vulnerability detection',
      },
      weekly_digest: {
        type: 'boolean',
        description: 'Receive weekly security digest',
      },
    },
  },
};
