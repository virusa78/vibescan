import { test, expect } from "@playwright/test";
import { generateTestEmail, loginUser, registerUser } from "./helpers";

async function acceptCookies(page: any) {
  const acceptAll = page.getByRole("button", { name: /accept all/i });
  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click();
  }
}

async function registerAndLogin(page: any, email: string, password: string) {
  await registerUser(page, email, password);

  if (!page.url().includes("dashboard")) {
    await loginUser(page, email, password);
  }

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle");
  await acceptCookies(page);
}

test("Settings and billing flows", async ({ page }) => {
  test.setTimeout(60_000);

  const email = generateTestEmail("settings-billing");
  const password = "TestPassword123!";

  await registerAndLogin(page, email, password);

  await page.goto("/settings");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("User Settings")).toBeVisible();

  await page.fill("#displayName", "E2E Test User");
  await page.fill("#timezone", "UTC");
  await page.selectOption("#language", "ru");
  await page.selectOption("#region", "IN");

  await page.getByRole("button", { name: /save settings/i }).click();
  await expect(page.getByText(/settings saved successfully/i)).toBeVisible();

  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("#displayName")).toHaveValue("E2E Test User");
  await expect(page.locator("#timezone")).toHaveValue("UTC");

  await page.goto("/account");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText("Account Information")).toBeVisible();
  await expect(page.getByRole("main").getByText(email)).toBeVisible();

  await page.getByRole("button", { name: /manage billing/i }).click();
  await page.waitForURL("/pricing");

  await expect(page.getByText(/pick your pricing/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /buy plan/i })).toHaveCount(3);
});

test("API keys and webhooks flows", async ({ page }) => {
  test.setTimeout(90_000);

  const email = generateTestEmail("keys-webhooks");
  const password = "TestPassword123!";

  await registerAndLogin(page, email, password);

  await page.goto("/api-keys");
  await page.waitForLoadState("networkidle");
  await acceptCookies(page);

  await expect(page.getByRole("heading", { name: "API Keys", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /generate new key/i }).click();
  await page.fill("#keyName", "E2E CI Key");
  await page.getByRole("button", { name: /^generate$/i }).click();

  await expect(page.getByText(/api key generated/i)).toBeVisible();
  await expect(page.getByText("E2E CI Key")).toBeVisible();
  await expect(page.locator("code").filter({ hasText: "vsk_" })).toBeVisible();

  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("button", { name: /revoke/i }).click();

  await expect(page.getByText(/api key revoked/i)).toBeVisible();
  await expect(page.getByText(/no api keys yet/i)).toBeVisible();

  await page.goto("/webhooks");
  await page.waitForLoadState("networkidle");
  await acceptCookies(page);

  await expect(page.getByRole("heading", { name: "Webhooks", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /add webhook/i }).click();

  const webhookUrl = `https://example.com/webhooks/vibescan/${Date.now()}`;
  await page.fill('input[type="url"]', webhookUrl);
  await page.getByRole("button", { name: /create/i }).click();

  const webhookCard = page
    .locator("code", { hasText: webhookUrl })
    .first()
    .locator("xpath=ancestor::div[contains(@class, 'card')][1]");

  await expect(webhookCard.getByText(/active/i)).toBeVisible();

  const toggleButton = webhookCard.getByRole("button", { name: /disable/i });
  await toggleButton.click();
  await expect(webhookCard.getByText(/inactive/i)).toBeVisible();
  await expect(webhookCard.getByRole("button", { name: /enable/i })).toBeVisible();

  await webhookCard.getByRole("button", { name: /enable/i }).click();
  await expect(webhookCard.getByText(/active/i)).toBeVisible();

  const deleteButton = webhookCard.locator("button", {
    has: webhookCard.locator('svg[data-lucide="trash2"]'),
  });

  if ((await deleteButton.count()) > 0) {
    await deleteButton.click();
  } else {
    await webhookCard.locator("button").last().click();
  }

  await expect(page.getByText(/no webhooks configured/i)).toBeVisible();
});
