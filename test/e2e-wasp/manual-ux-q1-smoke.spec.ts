import fs from "fs";
import { expect, test, type Page } from "@playwright/test";
import {
  generateTestEmail,
  loginUser,
  registerUser,
  submitScanFromForm,
  waitForScanCompletion,
} from "./helpers";

async function shot(page: Page, dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

test("UX Q1 smoke screenshots", async ({ page }) => {
  test.setTimeout(120_000);

  const email = generateTestEmail("ux-q1-smoke");
  const password = "TestPassword123!";
  const outputDir = "test-results/manual-ux-q1-smoke";

  await registerUser(page, email, password);
  await loginUser(page, email, password);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
  await shot(page, outputDir, "01-dashboard");

  await page.keyboard.press("Shift+Slash");
  await expect(page.getByRole("heading", { name: /keyboard shortcuts/i })).toBeVisible();
  await shot(page, outputDir, "02-shortcuts-overlay");
  await page.keyboard.press("Escape");

  const scanId = await submitScanFromForm(page, "https://github.com/lodash/lodash", "github");
  await page.goto(`/scans/${scanId}`);
  await waitForScanCompletion(page, 90_000, 3_000);
  await page.goto(`/reports/${scanId}`);
  await expect(page.getByRole("heading", { name: /^report$/i })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /all/i }).first()).toBeVisible();
  await shot(page, outputDir, "03-reports-severity-chips");

  await expect(page.getByRole("button", { name: /generate pdf/i })).toBeVisible();
  await shot(page, outputDir, "04-reports-full");
});
