import fs from "fs";
import { expect, test } from "@playwright/test";
import {
  generateTestEmail,
  loginUser,
  registerUser,
  submitScanFromForm,
} from "./helpers";

async function shot(page: any, dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test("UX Q1 skeleton states with delayed API", async ({ page }) => {
  test.setTimeout(120_000);

  const email = generateTestEmail("ux-q1-skeleton");
  const password = "TestPassword123!";
  const outputDir = "test-results/manual-ux-q1-skeleton-states";

  await registerUser(page, email, password);
  await loginUser(page, email, password);

  // New Scan page: delay recent scans query to capture list skeleton.
  await page.route("**/operations/getScans*", async (route) => {
    await delay(3500);
    await route.continue();
  });
  await page.goto("/new-scan");
  await expect(page.locator(".animate-pulse").first()).toBeVisible({ timeout: 10_000 });
  await shot(page, outputDir, "01-new-scan-loading-skeleton");
  await page.unroute("**/operations/getScans*");

  // Create a scan id to visit details page.
  const scanId = await submitScanFromForm(page, "https://github.com/lodash/lodash", "github");

  // Scan Details page: delay operation query to capture details skeleton.
  await page.route("**/operations/getScanById*", async (route) => {
    await delay(3500);
    await route.continue();
  });
  await page.goto(`/scans/${scanId}`);
  await expect(page.locator(".animate-pulse").first()).toBeVisible({ timeout: 10_000 });
  await shot(page, outputDir, "02-scan-details-loading-skeleton");
  await page.unroute("**/operations/getScanById*");
});
