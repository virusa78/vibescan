/**
 * E2E Test: Login and Dashboard
 *
 * Simple test to verify login works and dashboard opens
 */

import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const API_URL = process.env.API_URL || 'http://localhost:3000';

test('Login and open dashboard', async ({ page }) => {
  // Generate unique email
  const email = `e2e-test+${Date.now()}@example.com`;
  const password = 'Test123!@#';

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
  await expect(page.locator('h1')).toContainText('Login');

  // Fill in login form
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);

  // Submit form
  await page.getByRole('button', { name: 'Login' }).click();

  // Wait for navigation to dashboard
  await page.waitForURL(`${FRONTEND_URL}/dashboard`);

  // Verify dashboard loaded
  await expect(page.locator('h1')).toContainText('Dashboard');
});
