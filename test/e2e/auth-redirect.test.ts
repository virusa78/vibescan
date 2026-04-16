import { test, expect } from '@playwright/test';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3000';

test('Redirects to login when token exists but session is invalid', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('auth_token', 'invalid.token.value');
  });

  await page.goto(`${FRONTEND_URL}/settings`);

  await expect(page).toHaveURL(/\/login\?redirect=settings/);
  await expect(page.getByRole('heading', { name: /welcome back|login/i })).toBeVisible();
});
