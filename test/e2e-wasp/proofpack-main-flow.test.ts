import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}@example.com`;
}

async function shot(page: any, dir: string, name: string) {
  await mkdir(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function signupAndLogin(page: any, email: string, password: string, dir: string) {
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/signup/);
  await shot(page, dir, "01-signup-page");

  const acceptCookiesButton = page.getByRole("button", { name: /accept all/i });
  await acceptCookiesButton
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(async () => {
      await acceptCookiesButton.click();
      await shot(page, dir, "02-cookies-accepted");
    })
    .catch(() => {});

  await page.locator('input[type="email"]').first().fill(email);
  const passwordInputs = page.locator('input[type="password"]');
  const passwordCount = await passwordInputs.count();
  for (let i = 0; i < passwordCount; i++) {
    await passwordInputs.nth(i).fill(password);
  }
  await page.locator('button[type="submit"]').first().click();

  const signedInAfterSignup = await page
    .waitForURL(/\/dashboard|\/new-scan/, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);

  if (!signedInAfterSignup) {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await shot(page, dir, "03-login-page");
    await page.locator('input[type="email"]').first().fill(email);
    await page.locator('input[type="password"]').first().fill(password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForURL(/\/dashboard|\/new-scan/, { timeout: 20_000 });
  }
}

test("Scenario 1: auth -> submit scan -> scan details", async ({ page }) => {
  test.setTimeout(120_000);
  const dir = "test-results/proofpack-scenario-1";
  const email = uniqueEmail("proofpack-s1");
  const password = "ProofPack!123456";

  await signupAndLogin(page, email, password, dir);
  await page.goto("/dashboard");
  await shot(page, dir, "03-dashboard");

  await page.goto("/new-scan");
  await page.waitForURL(/\/new-scan/, { timeout: 20_000 });
  await shot(page, dir, "04-new-scan-page");

  await page.getByLabel("Input Reference").fill("anchore/grype");
  await page.locator("#inputType").selectOption("github");
  await shot(page, dir, "05-new-scan-filled");

  await page.getByRole("button", { name: /start scan/i }).click();
  await expect(page.getByText(/scan job created\./i)).toBeVisible();
  await shot(page, dir, "06-scan-created-toast");

  await page.getByRole("link", { name: /open details/i }).click();
  await page.waitForURL(/\/scans\/.+/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /scan details/i })).toBeVisible();
  await shot(page, dir, "07-scan-details");
});

test("Scenario 2: auth -> settings update", async ({ page }) => {
  test.setTimeout(120_000);
  const dir = "test-results/proofpack-scenario-2";
  const email = uniqueEmail("proofpack-s2");
  const password = "ProofPack!123456";

  await signupAndLogin(page, email, password, dir);
  await page.goto("/settings");
  await page.waitForURL(/\/settings/, { timeout: 20_000 });
  await shot(page, dir, "03-settings-page");

  await page.getByLabel("Display name").fill("Proofpack User");
  await page.getByLabel("Timezone").fill("UTC");
  await page.locator("#language").selectOption("en");
  await page.locator("#region").selectOption("OTHER");
  await shot(page, dir, "04-settings-filled");
  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText(/settings saved successfully\./i)).toBeVisible();
  await shot(page, dir, "05-settings-saved");
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard/);
  await shot(page, dir, "06-dashboard-after-settings");
});
