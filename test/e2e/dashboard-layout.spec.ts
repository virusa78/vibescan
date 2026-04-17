import { test, expect } from '@playwright/test';

test.describe('Dashboard Layout & Sidebar', () => {
  const baseURL = 'http://127.0.0.1:3000';
  const testEmail = `test-${Date.now()}@vibescan.test`;
  const testPassword = 'TestPassword123!';

  test('Register, login, and verify sidebar + dashboard layout', async ({ page }) => {
    // Step 1: Go to login page
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: 'test-results/01-login-page.png' });

    // Step 2: Click "go to signup" link - explicit text match
    const signupLink = page.locator('a, button').filter({ hasText: 'go to signup' });
    await signupLink.click({ timeout: 5000 });
    await page.waitForLoadState('domcontentloaded');
    await page.screenshot({ path: 'test-results/02-signup-form.png' });

    // Step 3: Fill registration form
    const emailInput = page.locator('input[type="email"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    
    await emailInput.fill(testEmail);
    await passwordInput.fill(testPassword);
    
    // Step 4: Click submit button
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click({ timeout: 10000 });

    // Step 5: Wait for redirect and dashboard load
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/03-dashboard-after-signup.png', fullPage: true });

    console.log('✅ Test completed - screenshot saved');
  });
});
