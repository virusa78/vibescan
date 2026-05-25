Zoho sync verification

1) Quick curl checks

- Trigger a resync (replace BACKEND_URL and API_TOKEN if needed):

curl -s -X POST "$BACKEND_URL/api/resyncZohoWorkspace" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_TOKEN" \
  -d '{"workspaceId":"YOUR_WORKSPACE_ID"}' | jq

- Get status:

curl -s "$BACKEND_URL/api/getZohoIntegrationStatus?workspaceId=YOUR_WORKSPACE_ID" \
  -H "Authorization: Bearer $API_TOKEN" | jq

Check fields: last_sync_at, state/status, last_error_message, last_sync_attempt_at.

2) SQL checks (Postgres)

-- Recent webhook deliveries related to Zoho
SELECT id, webhook_id, event, status_code, attempt, next_retry, created_at
FROM "WebhookDelivery"
WHERE event ILIKE '%zoho%' OR webhook_id IN (
  SELECT id FROM "Webhook" WHERE url ILIKE '%zoho%'
)
ORDER BY created_at DESC
LIMIT 50;

-- Failed deliveries in last 24h
SELECT * FROM "WebhookDelivery"
WHERE status_code IS NULL OR status_code >= 400
AND created_at >= now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 100;

3) Logs

- Check server logs (run.sh output, .wasp logs or docker-compose logs). Search for "zoho", "resync", "Zoho", "zohoapi".

4) Automated poll script

Use scripts/zoho/poll_zoho_sync.js to trigger a resync and poll until completion.

Usage example:

BACKEND_URL=http://127.0.0.1:3555 API_TOKEN=your_token WORKSPACE_ID=workspace-id node scripts/zoho/poll_zoho_sync.js

5) Common failure modes

- Authentication error: refresh token expired or invalid; check Settings -> Zoho Integration credentials.
- Rate limit / 429: implement exponential backoff and inspect last_error_message.
- Mapping errors: payload missing fields; inspect logs and workspace_snapshot.

6) Next improvements

- Add an admin operation that returns recent Zoho sync jobs and statuses.
- Record last payloads sent (redact secrets) for easier debugging.
