import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

function uniqueEmail() {
  return `wasp-e2e-${Date.now()}@example.com`;
}

const SCREENSHOT_DIR = "test-results/wasp-new-scan";

async function shot(page: any, name: string) {
  await mkdir(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test("WASP flow: login -> new scan submit", async ({ page, request }) => {
  test.setTimeout(90_000);
  const email = uniqueEmail();
  const password = "WaspE2E!23456789";
  const apiUrl = process.env.WASP_API_URL || "http://127.0.0.1:3001";

  const signupRes = await request.post(`${apiUrl}/auth/email/signup`, {
    data: { email, password },
  });
  expect(signupRes.ok()).toBeTruthy();

  await page.goto("/login");
  await expect(page).toHaveURL(/\/login/);
  await shot(page, "01-login-page");
  const acceptCookiesButton = page.getByRole("button", { name: /accept all/i });
  await acceptCookiesButton
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(async () => {
      await acceptCookiesButton.click();
      await shot(page, "02-cookies-accepted");
    })
    .catch(() => {});
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('button[type="submit"]').first().click();
  const redirectedAfterLogin = await page
    .waitForURL(/\/new-scan|\/demo-app|\/dashboard/, { timeout: 15_000 })
    .then(() => true)
    .catch(() => false);
  if (!redirectedAfterLogin) {
    const loginRes = await page.request.post(`${apiUrl}/auth/email/login`, {
      data: { email, password },
    });
    expect(loginRes.ok()).toBeTruthy();
  }
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("link", { name: /new scan/i })).toBeVisible();
  await shot(page, "03-dashboard-open");
  await page.goto("/new-scan");
  await page.waitForURL(/\/new-scan/, { timeout: 30_000 });
  await shot(page, "04-new-scan-open");

  await expect(page.getByText(/github scan input/i)).toBeVisible();

  await page.getByLabel("Repository (owner/name)").fill("anchore/grype");
  await page.getByLabel("Branch / Ref").fill("main");
  await page
    .getByLabel("Token override (optional)")
    .fill("ghp_example_private_repo_token");
  await shot(page, "05-form-filled");

  await page.getByRole("button", { name: /start scan/i }).click();
  await expect(page.getByText(/scan job created\./i)).toBeVisible();
  await page.getByRole("link", { name: /open details/i }).click();
  await page.waitForURL(/\/scans\/.+/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /scan details/i })).toBeVisible();
  await expect(page.getByText(/status:/i)).toBeVisible();
  await shot(page, "06-scan-details");
  await expect(page.getByText("anchore/grype")).toBeVisible();
  await shot(page, "07-scan-created");
});
