import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

test('Submitted scans are visible in Scans and Dashboard', async ({ page }) => {
  const email = `mock-visibility+${Date.now()}@example.com`;
  const password = 'Test123!@#AB';
  const refA = `mock-visibility-a@${Date.now()}`;
  const refB = `mock-visibility-b@${Date.now()}`;

  const registerResponse = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      name: 'Visibility Test',
      plan: 'free_trial',
      region: 'OTHER',
    },
  });
  expect(registerResponse.status()).toBe(201);

  await page.goto(`${FRONTEND_URL}/login`);
  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByPlaceholder('••••••••').first().fill(password);
  await page.getByRole('button', { name: /sign in|login/i }).click();

  await page.waitForURL(`${FRONTEND_URL}/dashboard`);
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  expect(token).toBeTruthy();

  const scanResponseA = await page.request.post(`${API_URL}/scans`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      inputType: 'sbom_upload',
      inputRef: refA,
      sbomRaw: { bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, components: [] },
    },
  });
  expect(scanResponseA.status()).toBe(202);

  const scanResponseB = await page.request.post(`${API_URL}/scans`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      inputType: 'sbom_upload',
      inputRef: refB,
      sbomRaw: { bomFormat: 'CycloneDX', specVersion: '1.5', version: 1, components: [] },
    },
  });
  expect(scanResponseB.status()).toBe(202);

  await page.goto(`${FRONTEND_URL}/scans`);
  await expect(page.getByRole('heading', { name: 'Scans', exact: true })).toBeVisible();
  await expect(page.locator('table').getByText(/mock-visibility-a\s*@/i).first()).toBeVisible();
  await expect(page.locator('table').getByText(/mock-visibility-b\s*@/i).first()).toBeVisible();

  await page.goto(`${FRONTEND_URL}/dashboard`);
  await expect(page.getByText(/mock-visibility-a\s*@/i).first()).toBeVisible();
  await expect(page.getByText(/mock-visibility-b\s*@/i).first()).toBeVisible();
});
