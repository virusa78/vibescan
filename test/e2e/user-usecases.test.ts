import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const SCREENSHOT_DIR = 'test-results/manual-screens';

async function saveStepScreenshot(page: any, filename: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: true });
}

async function seedAuthSession(page: any, email: string, password: string): Promise<string> {
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(response.status()).toBe(200);
  const payload = await response.json();
  const accessToken = payload?.data?.accessToken || payload?.accessToken || payload?.token || '';
  const refreshToken = payload?.data?.refreshToken || payload?.refreshToken || '';
  const user = payload?.data?.user || payload?.user || { email };
  await page.addInitScript(
    ({ token, refresh, currentUser }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('vibescan_tokens', JSON.stringify({ accessToken: token, refreshToken: refresh }));
      localStorage.setItem('user', JSON.stringify(currentUser));
    },
    { token: accessToken, refresh: refreshToken, currentUser: user },
  );
  return accessToken;
}

test.describe('User E2E use-cases', () => {
  test('Use-case 1: new user logs in, triggers scan, checks vulnerabilities page', async ({ page }) => {
    const email = `usecase1+${Date.now()}@example.com`;
    const password = 'Test123!@#AB';

    const registerResponse = await page.request.post(`${API_URL}/auth/register`, {
      data: {
        email,
        password,
        name: 'Usecase One',
        plan: 'free_trial',
        region: 'OTHER',
      },
    });
    expect(registerResponse.status()).toBe(201);

    await page.goto(`${FRONTEND_URL}/login`);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(0);
    await saveStepScreenshot(page, 'usecase1-01-login.png');

    const accessToken = await seedAuthSession(page, email, password);
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(1);
    await saveStepScreenshot(page, 'usecase1-02-dashboard.png');

    const submitScanResponse = await page.request.post(`${API_URL}/scans`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        inputType: 'sbom_upload',
        sbomRaw: {
          bomFormat: 'CycloneDX',
          specVersion: '1.5',
          version: 1,
          metadata: {
            component: { type: 'application', name: 'usecase-app', version: '1.0.0' },
          },
          components: [
            { type: 'library', name: 'lodash', version: '4.17.21' },
            { type: 'library', name: 'axios', version: '1.7.0' },
          ],
        },
      },
    });
    expect(submitScanResponse.status()).toBe(202);

    await page.goto(`${FRONTEND_URL}/scans`);
    await expect(page.getByRole('heading', { name: 'Scans', exact: true })).toBeVisible();
    await saveStepScreenshot(page, 'usecase1-03-scans.png');

    await page.goto(`${FRONTEND_URL}/vulnerabilities`);
    const hasReportHeading = await page.getByRole('heading', { name: /vulnerabilities|vulnerability report/i }).isVisible().catch(() => false);
    if (!hasReportHeading) {
      await expect(page.getByText(/report is not available yet/i)).toBeVisible();
    }
    await saveStepScreenshot(page, 'usecase1-04-vulnerabilities.png');
  });

  test('Use-case 2: enterprise user reviews dashboard, github integration, settings, api docs', async ({ page }) => {
    await seedAuthSession(page, 'rafael.torres@securecorp.com', 'vs_demo_ent_2026');
    await page.goto(`${FRONTEND_URL}/dashboard`);
    await page.waitForURL(`${FRONTEND_URL}/dashboard`);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(1);
    await saveStepScreenshot(page, 'usecase2-01-dashboard.png');

    await page.goto(`${FRONTEND_URL}/github`);
    await expect(page.getByRole('heading', { name: /github integration/i })).toBeVisible();
    await saveStepScreenshot(page, 'usecase2-02-github.png');

    await page.goto(`${FRONTEND_URL}/settings`);
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
    await saveStepScreenshot(page, 'usecase2-03-settings.png');

    await page.goto(`${FRONTEND_URL}/api-reference`);
    await expect(page.getByRole('heading', { name: 'Auth' })).toBeVisible();
    await saveStepScreenshot(page, 'usecase2-04-api-reference.png');
  });
});
