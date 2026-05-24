#!/usr/bin/env node
// polls Zoho resync status via Wasp operations endpoints
// Usage: BACKEND_URL=http://127.0.0.1:3555 API_TOKEN=your_token WORKSPACE_ID=workspace-id node scripts/zoho/poll_zoho_sync.js

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3555';
const API_TOKEN = process.env.API_TOKEN; // optional, if your backend requires auth
const WORKSPACE_ID = process.env.WORKSPACE_ID; // optional
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000', 10);
const TIMEOUT = parseInt(process.env.TIMEOUT || '300000', 10);

if (!BACKEND_URL) {
  console.error('Set BACKEND_URL env var');
  process.exit(2);
}

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`;
  return headers;
}

async function postResync() {
  const url = `${BACKEND_URL.replace(/\/$/, '')}/api/resyncZohoWorkspace`;
  const body = WORKSPACE_ID ? { workspaceId: WORKSPACE_ID } : {};
  const res = await fetch(url, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`resync failed: ${res.status} ${res.statusText}`);
  return res.json();
}

async function getStatus() {
  const params = WORKSPACE_ID ? `?workspaceId=${encodeURIComponent(WORKSPACE_ID)}` : '';
  const url = `${BACKEND_URL.replace(/\/$/, '')}/api/getZohoIntegrationStatus${params}`;
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`status failed: ${res.status} ${res.statusText}`);
  return res.json();
}

(async () => {
  console.log('Triggering Zoho resync...');
  try {
    const start = Date.now();
    const trigger = await postResync();
    console.log('Resync triggered:', JSON.stringify(trigger));

    while (true) {
      const status = await getStatus();
      const now = Date.now();
      console.log(`[${new Date().toISOString()}] status:`, JSON.stringify(status));

      // Expect status to contain a field 'state' or 'status' and optionally last_error
      const state = status?.state || status?.status || status?.syncState || null;
      if (state) {
        const s = String(state).toLowerCase();
        if (s === 'completed' || s === 'success' || s === 'synced') {
          console.log('Sync finished successfully');
          process.exit(0);
        }
        if (s === 'failed' || s === 'error') {
          console.error('Sync finished with error:', status);
          process.exit(3);
        }
      }

      if (status?.last_error_message) {
        console.warn('Last error:', status.last_error_message);
      }

      if (now - start > TIMEOUT) {
        console.error('Timeout waiting for sync');
        process.exit(4);
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL));
    }
  } catch (err) {
    console.error('Error:', err);
    process.exit(5);
  }
})();
