import fs from "fs";
import type { Page } from "@playwright/test";
import { test, expect } from "@playwright/test";
import {
  generateTestEmail,
  loginUser,
  registerUser,
  uploadSbomFile,
} from "./helpers";

async function shot(page: Page, dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function acceptCookies(page: Page) {
  const acceptAll = page.getByRole("button", { name: /accept all/i });
  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click();
  }
}

test("Dashboard scan proofpack - login, scan, dashboard row", async ({ page }) => {
  test.setTimeout(180_000);

  const email = generateTestEmail("dashboard-proofpack");
  const password = "TestPassword123!";
  const outputDir = "test-results/dashboard-scan-proofpack";
  const sbomPath = "test/fixtures/sample.sbom.json";

  await registerUser(page, email, password);
  if (!page.url().includes("/dashboard")) {
    await loginUser(page, email, password);
  }

  await page.goto("/dashboard");
  await acceptCookies(page);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Loading...").first()).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
  await shot(page, outputDir, "01-dashboard-empty");

  await expect(page.getByText(/no scans yet/i)).toBeVisible();

  await uploadSbomFile(page, sbomPath);
  await shot(page, outputDir, "02-scan-submitted");

  await page.getByRole("link", { name: /open details/i }).click();
  await expect(
    page.getByText(/scan failed|scanning in progress|loading scan details/i)
  ).toBeVisible({ timeout: 20_000 });
  const backButton = page.getByRole("button", { name: /back to dashboard|return to dashboard/i });
  if (await backButton.isVisible().catch(() => false)) {
    await backButton.click();
  } else {
    await page.goto("/dashboard");
  }

  await page.goto("/dashboard");
  await acceptCookies(page);
  await expect(page.getByText("Loading...").first()).toBeHidden({ timeout: 20_000 });
  await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
  const scanRows = page.locator("table tbody tr");
  const start = Date.now();
  while ((await scanRows.count()) === 0 && Date.now() - start < 120_000) {
    await page.reload({ waitUntil: "networkidle" });
    await acceptCookies(page);
    await page.waitForTimeout(3000);
  }
  await expect(scanRows).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByText(/recent scans/i)).toBeVisible();
  await shot(page, outputDir, "03-dashboard-with-scan");
});
