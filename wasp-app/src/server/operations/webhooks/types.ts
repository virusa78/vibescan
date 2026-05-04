export type AuthenticatedUser = {
  id: string;
  workspaceId: string;
};

export type WebhookDeliveryStatus = 'pending' | 'delivered' | 'failed' | 'exhausted';

export type ActionResponse = {
  success: boolean;
  message: string;
};

export type QueuedWebhookDeliveryResponse = {
  queued: boolean;
  delivery_id: string;
};

export type WebhookListItem = {
  id: string;
  url: string;
  created_at: Date;
  events: string[];
  enabled: boolean;
  lastTriggeredAt: string | null;
  deliverySuccessRate: number;
};

export type WebhookListResponse = {
  webhooks: WebhookListItem[];
};

export type WebhookDeliveryStats = {
  total_attempts: number;
  successful: number;
  failed: number;
  pending: number;
};

export type WebhookDeliveryListItem = {
  id: string;
  status: string;
  status_code: number | null;
  duration: number | null;
  event: string;
  attempt: number;
  timestamp: string;
  delivered_at: string | null;
  scan_id: string;
  payload: unknown;
  response: string | null;
  manual_retry_of_id: string | null;
};

export type ListWebhookDeliveriesResponse = {
  deliveries: WebhookDeliveryListItem[];
  next_cursor: string | null;
};

export type WebhookDetailResponse = {
  webhook: {
    id: string;
    url: string;
    created_at: Date;
    events: string[];
    enabled: boolean;
  };
  delivery_stats: WebhookDeliveryStats;
  last_5_deliveries: Array<{
    id: string;
    scan_id: string;
    status: string;
    http_status: number | null;
    event: string;
    attempt: number;
    duration: number | null;
    created_at: Date;
    delivered_at: Date | null;
    payload: unknown;
    response: string | null;
  }>;
};

export type WebhookOwnershipRecord = {
  id: string;
  userId: string;
  workspaceId?: string | null;
  url: string;
  createdAt: Date;
  events: string[];
  enabled: boolean;
  signingSecretEncrypted: string;
};

export type WebhookDeliverySummaryRecord = {
  status: WebhookDeliveryStatus;
  createdAt: Date;
};

export type WebhookSummaryRecord = {
  id: string;
  url: string;
  createdAt: Date;
  events: string[];
  enabled: boolean;
  deliveries: WebhookDeliverySummaryRecord[];
};

export type WebhookDeliveryRecord = {
  id: string;
  webhookId: string;
  scanId: string;
  status: WebhookDeliveryStatus;
  payload: unknown;
  targetUrl: string;
  payloadHash: string;
  eventType: string;
  attemptNumber: number;
  httpStatus?: number | null;
  createdAt?: Date;
  deliveredAt?: Date | null;
  durationMs?: number | null;
  responseBody?: string | null;
  manualRetryOfId?: string | null;
};

export function calculateDeliverySuccessRate(deliveries: WebhookDeliverySummaryRecord[]): number {
  if (deliveries.length === 0) {
    return 0;
  }

  const successful = deliveries.filter((delivery) => delivery.status === 'delivered').length;
  return Math.round((successful / deliveries.length) * 100);
}

export function calculateWebhookDeliveryStats(deliveries: Array<{ status: WebhookDeliveryStatus }>): WebhookDeliveryStats {
  return {
    total_attempts: deliveries.length,
    successful: deliveries.filter((delivery) => delivery.status === 'delivered').length,
    failed: deliveries.filter((delivery) => delivery.status === 'failed').length,
    pending: deliveries.filter((delivery) => delivery.status === 'pending').length,
  };
}
