import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';
const DEMO_EMAIL = 'rafael.torres@securecorp.com';
const DEMO_PASSWORD = 'vs_demo_ent_2026';

test('Settings subpages are reachable and wired to settings endpoints', async ({ page }) => {
  const loginResponse = await page.request.post(`${API_URL}/auth/login`, {
    data: { email: DEMO_EMAIL, password: DEMO_PASSWORD },
  });
  expect(loginResponse.status()).toBe(200);
  const payload = await loginResponse.json();
  const accessToken = payload?.data?.accessToken || payload?.accessToken || payload?.token || '';
  const refreshToken = payload?.data?.refreshToken || payload?.refreshToken || '';
  const user = payload?.data?.user || payload?.user || { email: DEMO_EMAIL };

  await page.addInitScript(
    ({ token, refresh, currentUser }) => {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('vibescan_tokens', JSON.stringify({ accessToken: token, refreshToken: refresh }));
      localStorage.setItem('user', JSON.stringify(currentUser));
    },
    { token: accessToken, refresh: refreshToken, currentUser: user },
  );

  await page.goto(`${FRONTEND_URL}/settings`);
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

  await page.getByRole('link', { name: /manage →/i }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/settings/api-keys`);
  await expect(page.getByRole('heading', { name: 'API Keys', exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_URL}/settings`);
  await page.getByRole('link', { name: /configure →/i }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/settings/webhooks`);
  await expect(page.getByRole('heading', { name: 'Webhooks', exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_URL}/settings`);
  await page.getByRole('link', { name: /manage plan/i }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/settings/billing`);
  await expect(page.getByRole('heading', { name: 'Billing & Plan', exact: true })).toBeVisible();

  await page.goto(`${FRONTEND_URL}/settings`);
  await page.getByRole('button', { name: /^View$/ }).click();
  await expect(page).toHaveURL(`${FRONTEND_URL}/settings/security`);
  await expect(page.getByRole('heading', { name: 'Security', exact: true })).toBeVisible();
});
