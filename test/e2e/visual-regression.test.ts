import { test, expect, type Page } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

async function loginAsFreshUser(page: Page) {
  const email = `visual+${Date.now()}@example.com`;
  const password = 'Test123!@#AB';

  const registerResponse = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      name: 'Visual Baseline',
      plan: 'free_trial',
      region: 'OTHER',
    },
  });
  expect(registerResponse.status()).toBe(201);
  const loginResponse = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });
  expect(loginResponse.status()).toBe(200);
  const payload = await loginResponse.json();
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
  await page.goto(`${FRONTEND_URL}/dashboard`);
  await page.waitForURL(`${FRONTEND_URL}/dashboard`);
}

test.describe('Visual regression baselines', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('auth pages baseline', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/login`);
    await expect(page).toHaveScreenshot('auth-login.png');

    await page.goto(`${FRONTEND_URL}/register`);
    await expect(page).toHaveScreenshot('auth-register.png');
  });

  test('dashboard and scans baseline', async ({ page }) => {
    await loginAsFreshUser(page);

    await expect(page).toHaveScreenshot('dashboard-shell.png', {
      maxDiffPixels: 1200,
      mask: [
        page.locator('text=Last updated:'),
        page.locator('text=Live Activity'),
        page.locator('table tbody'),
      ],
    });

    await page.goto(`${FRONTEND_URL}/scans`);
    await expect(page).toHaveScreenshot('scans-shell.png', {
      maxDiffPixels: 800,
      mask: [page.locator('table tbody')],
    });
  });
});
