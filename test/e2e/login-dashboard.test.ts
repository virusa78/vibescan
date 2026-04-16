/**
 * E2E Test: Login and Dashboard
 *
 * Simple test to verify login works and dashboard opens
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';
const API_URL = process.env.API_URL || 'http://127.0.0.1:3001';

test('Login and open dashboard', async ({ page }) => {
  // Generate unique email
  const email = `e2e-test+${Date.now()}@example.com`;
  const password = 'Test123!@#AB';

  // Register user
  const registerResponse = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email,
      password,
      name: 'E2E Test',
      plan: 'free_trial',
      region: 'OTHER'
    }
  });
  expect(registerResponse.ok()).toBeTruthy();

  // Go to login page
  await page.goto(`${FRONTEND_URL}/login`);
  await expect(page.locator('h1')).toContainText(/Welcome back|Login/i);

  // Fill in login form
  await page.getByPlaceholder('name@company.com').fill(email);
  await page.getByPlaceholder('••••••••').first().fill(password);

  // Submit form
  await page.getByRole('button', { name: /Sign In|Login/i }).click();

  // Wait for navigation to dashboard
  await page.waitForURL(`${FRONTEND_URL}/dashboard`);

  // Verify dashboard loaded
  await expect(page.locator('h1')).toContainText('Dashboard');

  // Logout from sidebar profile actions
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL(`${FRONTEND_URL}/login`);
  await expect(page.locator('h1')).toContainText(/Welcome back|Login/i);
});
