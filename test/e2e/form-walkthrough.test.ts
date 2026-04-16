import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const SCREENSHOT_DIR = 'test-results/manual-screens';
const DEMO_EMAIL = 'rafael.torres@securecorp.com';
const DEMO_PASSWORD = 'vs_demo_ent_2026';

async function saveStepScreenshot(page: any, filename: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${filename}`, fullPage: true });
}

async function seedAuthSession(page: any, email: string, password: string) {
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
}

test('Full forms walkthrough: auth + settings', async ({ page }) => {
  await page.goto(`${FRONTEND_URL}/login`);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await expect(page.locator('aside')).toHaveCount(0);
  await saveStepScreenshot(page, 'forms-01-login-form.png');

  await page.getByRole('button', { name: /create one free/i }).click();
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
  await saveStepScreenshot(page, 'forms-02-register-form.png');

  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  await seedAuthSession(page, DEMO_EMAIL, DEMO_PASSWORD);
  await page.goto(`${FRONTEND_URL}/dashboard`);
  await page.waitForURL(`${FRONTEND_URL}/dashboard`);
  await expect(page.locator('aside')).toHaveCount(1);
  await page.goto(`${FRONTEND_URL}/settings`);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await saveStepScreenshot(page, 'forms-03-settings-overview.png');

  await expect(page.getByRole('heading', { name: 'User Profile', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Account Settings', exact: true })).toBeVisible();
  await saveStepScreenshot(page, 'forms-04-settings-sections.png');
});
