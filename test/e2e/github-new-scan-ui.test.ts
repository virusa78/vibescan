import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const SCREENSHOT_DIR = 'test-results/github-scan-ui';

async function saveStepScreenshot(page: any, filename: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: true });
}

async function waitForTerminalScanState(page: any, scanId: string, token: string, timeoutMs = 6 * 60 * 1000) {
  const startedAt = Date.now();
  let lastStatus = 'pending';
  let lastErrorMessage: string | null = null;

  while (Date.now() - startedAt < timeoutMs) {
    const response = await page.request.get(`${API_URL}/scans/${scanId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (response.ok()) {
      const payload = await response.json();
      const scan = payload?.data?.scan;
      lastStatus = scan?.status || lastStatus;
      lastErrorMessage = scan?.errorMessage || null;

      if (['done', 'error', 'cancelled'].includes(lastStatus)) {
        return { status: lastStatus, errorMessage: lastErrorMessage };
      }
    }

    await page.waitForTimeout(2000);
  }

  return { status: lastStatus, errorMessage: lastErrorMessage };
}

test('UI flow: login -> New Scan -> GitHub repo scan (anchore/grype)', async ({ page }, testInfo) => {
  test.setTimeout(8 * 60 * 1000);
  const email = 'arjun.mehta@finstack.io';
  const password = 'vs_demo_pro_2026';

  await page.goto(`${FRONTEND_URL}/login`);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await saveStepScreenshot(page, '01-login-page.png');

  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByPlaceholder('••••••••').first().fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(`${FRONTEND_URL}/dashboard`);
  await expect(page.getByRole('heading', { name: /scan dashboard/i })).toBeVisible();
  await saveStepScreenshot(page, '02-dashboard.png');

  await page.getByRole('button', { name: /new scan/i }).click();
  await expect(page.getByRole('heading', { name: /initiate new scan/i })).toBeVisible();
  await saveStepScreenshot(page, '03-new-scan-modal-open.png');

  await page.getByRole('button', { name: /github repo/i }).click();
  await page.getByPlaceholder('owner/repository').fill('https://github.com/anchore/grype');
  await page.getByPlaceholder('main').fill('main');
  await saveStepScreenshot(page, '04-github-fields-filled.png');

  const createScanResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/scans') &&
      response.request().method() === 'POST'
    ,
    { timeout: 60_000 }
  );

  await page.getByRole('button', { name: /^start scan$/i }).click();
  const createScanResponse = await createScanResponsePromise;
  expect(createScanResponse.status()).toBe(202);
  const createScanPayload = await createScanResponse.json();
  const scanId = createScanPayload?.data?.scanId || createScanPayload?.data?.id;
  expect(scanId).toBeTruthy();
  await saveStepScreenshot(page, '05-scan-queued.png');

  await page.goto(`${FRONTEND_URL}/scans`);
  await expect(page.getByRole('heading', { name: 'Scans', exact: true })).toBeVisible();
  await expect(page.locator('tbody tr').filter({ hasText: scanId })).toBeVisible();
  await saveStepScreenshot(page, '06-scan-visible-in-list.png');

  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(token).toBeTruthy();

  const terminal = await waitForTerminalScanState(page, scanId, token as string);
  await testInfo.attach('scan-terminal-state', {
    body: JSON.stringify({ scanId, ...terminal }, null, 2),
    contentType: 'application/json',
  });

  await page.reload();
  await saveStepScreenshot(page, '07-final-scan-state.png');

  expect(['done', 'error']).toContain(terminal.status);
});
