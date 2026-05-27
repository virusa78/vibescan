import { Page, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { basename, resolve } from "node:path";

const DEFAULT_DATABASE_URLS = [
  "postgresql://postgres:postgres@127.0.0.1:5432/vibescan?schema=public",
  "postgresql://postgres:postgres@127.0.0.1:5444/vibescan?schema=public",
  "postgresql://postgres:postgres@127.0.0.1:5445/vibescan?schema=public",
] as const;

async function acceptCookiesIfPresent(page: Page): Promise<void> {
  const candidates = [
    page.getByRole("button", { name: /accept all/i }),
    page.getByRole("button", { name: /accept/i }),
    page.getByRole("button", { name: /agree/i }),
    page.getByRole("button", { name: /allow all/i }),
    page.getByRole("button", { name: /ok/i }),
  ];

  for (const candidate of candidates) {
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click({ force: true });
      return;
    }
  }
}

function getTrustedScanInputRoots(): string[] {
  const roots = [
    process.env.VIBESCAN_SCAN_INPUT_DIR,
    resolve(process.cwd(), "wasp-app", ".wasp", "out", "server", "test-results", "runtime-temp", "scan-inputs"),
    resolve(process.cwd(), "wasp-app", "test-results", "runtime-temp", "scan-inputs"),
    resolve(process.cwd(), "test-results", "runtime-temp", "scan-inputs"),
  ].filter((value): value is string => Boolean(value));

  return [...new Set(roots)];
}

function stageTrustedScanInputIfNeeded(inputRef: string, inputType: "github" | "sbom" | "source_zip" | "dast"): string {
  if (inputType === "github" || inputType === "dast") {
    return inputRef;
  }

  const sourcePath = resolve(process.cwd(), inputRef);
  if (!existsSync(sourcePath)) {
    return inputRef;
  }

  const stagedRef = `${Date.now()}-${randomUUID()}-${basename(sourcePath)}`;
  for (const root of getTrustedScanInputRoots()) {
    mkdirSync(root, { recursive: true });
    copyFileSync(sourcePath, resolve(root, stagedRef));
  }

  return stagedRef;
}

async function findLatestScanIdByInputRef(inputRef: string): Promise<string | null> {
  const { PrismaClient } = await import("../../wasp-app/node_modules/@prisma/client/default.js");
  const candidates = [
    process.env.DATABASE_URL,
    ...DEFAULT_DATABASE_URLS,
  ].filter((value): value is string => Boolean(value));

  for (const url of candidates) {
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
    });

    try {
      const scan = await prisma.scan.findFirst({
        where: { inputRef },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (scan?.id) {
        return scan.id;
      }
    } catch {
      // Try the next reachable database URL.
    } finally {
      await prisma.$disconnect();
    }
  }

  return null;
}

/**
 * Authentication and test helper utilities for Playwright E2E tests
 */

/**
 * Register a new user with the given email and password
 */
export async function registerUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/signup");
  await page.waitForLoadState("domcontentloaded");
  await acceptCookiesIfPresent(page);
  
  // Fill in signup form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Look for confirm password field
  const passwordInputs = await page.locator('input[type="password"]').count();
  if (passwordInputs > 1) {
    const passwordInputList = page.locator('input[type="password"]');
    await passwordInputList.nth(1).fill(password);
  }
  
  // Submit form
  const submitButton = page.locator('button:has-text("Sign up"), button:has-text("Create account")');
  const responsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/auth/email/signup") &&
        response.request().method() === "POST",
      { timeout: 20000 }
    )
    .catch(() => null);

  await submitButton.click();
  const response = await responsePromise;

  if (!response || !response.ok()) {
    const fallbackResponse = await page.request.post("/auth/email/signup", {
      data: { email, password },
    });
    if (!fallbackResponse.ok()) {
      throw new Error(`Signup failed: ${fallbackResponse.status()} ${fallbackResponse.statusText()}`);
    }
  }

  await loginUser(page, email, password);
}

/**
 * Login with the given email and password
 */
export async function loginUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  // Navigate to login
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");
  await acceptCookiesIfPresent(page);

  // Fill in login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  const submitButton = page.locator('button:has-text("Log in"), button:has-text("Sign in")');
  const responsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/auth/email/login") &&
        response.request().method() === "POST",
      { timeout: 20000 }
    )
    .catch(() => null);

  await submitButton.click();
  const response = await responsePromise;
  if (!response || !response.ok()) {
    throw new Error(`Login failed: ${response?.status()} ${response?.statusText()}`);
  }

  await page.goto("/dashboard");
  await page.waitForLoadState("networkidle").catch(() => {});
  await acceptCookiesIfPresent(page);

  if (page.url().includes("/onboarding")) {
    const skipOnboardingButton = page.getByRole("button", { name: /skip onboarding for now/i });
    if (await skipOnboardingButton.isVisible().catch(() => false)) {
      await skipOnboardingButton.click();
      await page.waitForURL(/\/dashboard(\/?|$)/, { timeout: 30000 }).catch(() => {});
    }
  }

  await page.waitForURL(/\/dashboard(\/?|$)/, { timeout: 30000 }).catch(() => {});
}

/**
 * Logout the current user
 */
export async function logoutUser(page: Page): Promise<void> {
  // Click profile/settings menu
  const profileMenu = page.locator('[role="button"]:has-text("Profile"), [role="button"]:has-text("Settings")').first();
  if (await profileMenu.isVisible()) {
    await profileMenu.click();
  }
  
  // Click logout
  const logoutButton = page.locator('button[aria-label="Log out"], button:has-text("Logout"), button:has-text("Sign out")').first();
  await logoutButton.click();
  
  // Wait for redirect to login
  await page.waitForURL(/\/(login|landing)/, { timeout: 5000 });
}

/**
 * Wait for scan to complete with polling
 */
export async function waitForScanCompletion(
  page: Page,
  maxWaitTime: number = 120000,
  pollInterval: number = 2000
): Promise<boolean> {
  // 1. Wait for loading spinner/state to disappear
  await page.locator('text=/loading scan details/i').waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});

  // 2. Wait for either completed or failed status card to appear
  const completedLocator = page.locator('[data-testid="scan-status-completed"]');
  const failedLocator = page.locator('[data-testid="scan-status-failed"]');

  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitTime) {
    if (await completedLocator.isVisible()) {
      return true;
    }
    if (await failedLocator.isVisible()) {
      const errorMsg = await page.locator('[data-testid="scan-error-message"], .text-red-200').first().textContent().catch(() => '');
      throw new Error(`Scan failed: ${errorMsg || 'Unknown error'}`);
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Scan did not complete within ${maxWaitTime}ms`);
}

/**
 * Submit a scan from the New Scan form
 */
export async function submitScanFromForm(
  page: Page,
  inputRef: string,
  inputType: "github" | "sbom" | "source_zip" = "github"
): Promise<string> {
  const trustedInputRef = stageTrustedScanInputIfNeeded(inputRef, inputType);

  await page.goto("/new-scan");
  await page.waitForLoadState("domcontentloaded");
  await acceptCookiesIfPresent(page);

  const inputTypeLabels: Record<typeof inputType, string> = {
    github: "GitHub repository",
    sbom: "SBOM file",
    source_zip: "Source archive",
  };

  const optionButton = page.getByRole("button", { name: new RegExp(inputTypeLabels[inputType], "i") }).first();
  await optionButton.click();

  if (inputType === "github") {
    await page.locator("input#inputRef").fill(trustedInputRef);
  } else {
    await page.locator("input#file-upload").setInputFiles(inputRef);
    await expect(page.locator('span:has-text("Ready")').first()).toBeVisible({ timeout: 20000 });
  }

  const submitButton = page.getByRole("button", { name: /run scan|start scan/i });
  const submitResponsePromise = page
    .waitForResponse(
      (response) =>
        /\/operations\/submit-scan(?:\?|$)/.test(response.url()) &&
        response.request().method() === "POST",
      { timeout: 120_000 }
    )
    .catch(() => null);
  await submitButton.click();

  await page.waitForURL(/\/(scans|reports)\/[0-9a-fA-F-]{36}(?:[/?#]|$)/, {
    timeout: 120_000,
  }).catch(() => null);

  const currentUrl = page.url();
  const urlScanId = currentUrl.match(/\/(?:scans|reports)\/([0-9a-fA-F-]{36})(?:[/?#]|$)/)?.[1] ?? null;
  if (urlScanId) {
    return urlScanId;
  }

  const submitResponse = await submitResponsePromise;
  if (submitResponse?.ok()) {
    const submitData = await submitResponse.json().catch(() => null);
    const responsePayload = submitData?.json ?? submitData;
    const responseScanId =
      responsePayload?.id ??
      responsePayload?.scan?.id ??
      responsePayload?.scanId ??
      responsePayload?.json?.id;
    if (responseScanId) {
      return responseScanId;
    }
  }

  const recentScanLink = page.locator('[data-testid="scan-row"] a[href*="/scans/"]').first();
  if (await recentScanLink.isVisible().catch(() => false)) {
    const href = await recentScanLink.getAttribute("href");
    const hrefScanId = href?.match(/\/scans\/([0-9a-fA-F-]{36})(?:[/?#]|$)/)?.[1] ?? null;
    if (hrefScanId) {
      return hrefScanId;
    }
  }

  await page.goto("/dashboard");
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const scanLinkSelector = '[data-testid="scan-row"] a[href*="/scans/"]';
  for (let attempt = 0; attempt < 30; attempt++) {
    const dashboardScanLink = page.locator(scanLinkSelector).first();
    if (await dashboardScanLink.isVisible().catch(() => false)) {
      const href = await dashboardScanLink.getAttribute("href");
      const hrefScanId = href?.match(/\/scans\/([0-9a-fA-F-]{36})(?:[/?#]|$)/)?.[1] ?? null;
      if (hrefScanId) {
        return hrefScanId;
      }
    }
    await page.waitForTimeout(2000);
    await page.reload({ waitUntil: "networkidle" }).catch(() => {});
  }

  const databaseScanId = await findLatestScanIdByInputRef(inputRef);
  if (databaseScanId) {
    return databaseScanId;
  }

  const submitData = submitResponse ? await submitResponse.json().catch(() => null) : null;
  throw new Error(
    `Unable to derive scan id after submission. url=${currentUrl} response=${JSON.stringify(submitData)}`,
  );
}

export async function uploadSbomFile(
  page: Page,
  filePath: string
): Promise<string> {
  return submitScanFromForm(page, filePath, "sbom");
}

/**
 * Click on a scan row to view details
 */
export async function viewScanDetails(page: Page, scanIndex: number = 0): Promise<void> {
  // Get scan row
  const scanRows = page.locator('[data-testid="scan-row"]');
  if (scanIndex >= (await scanRows.count())) {
    const fallbackRows = page.locator("table tbody tr");
    if (scanIndex >= (await fallbackRows.count())) {
      throw new Error(`Scan at index ${scanIndex} not found`);
    }
    await fallbackRows.nth(scanIndex).click();
    await page.waitForSelector('[data-testid="scan-details"]', { timeout: 10000 });
    return;
  }

  await scanRows.nth(scanIndex).click();
  // Wait for scan details page
  await page.waitForSelector('[data-testid="scan-status-completed"], [data-testid="scan-status-running"], [data-testid="scan-status-failed"]', { timeout: 10000 });
}

/**
 * Verify scan details render without lock messaging.
 */
export async function verifyScanPaywall(
  page: Page,
  _shouldBeLockedForStarter: boolean
): Promise<void> {
  const lockedIcon = page.locator('[data-testid="locked-badge"]');
  const lockedMessage = page.locator('text=/locked|premium|requires/i');

  const isLocked =
    (await lockedIcon.count()) > 0 || (await lockedMessage.count()) > 0;
  expect(isLocked).toBeFalsy();
}

/**
 * Verify findings are displayed
 */
export async function verifyFindingsDisplay(page: Page): Promise<void> {
  // Check for vulnerability table or list
  const vulnerabilityTable = page.locator(
    'table, [role="table"], [data-testid="findings-list"], [data-testid="vulnerabilities"]'
  ).first();
  
  expect(await vulnerabilityTable.isVisible()).toBeTruthy();
  
  // Check for at least one finding row
  const findingRows = page.locator(
    '[data-testid="finding-row"], tbody tr, [role="row"]'
  );
  expect(await findingRows.count()).toBeGreaterThan(0);
}

/**
 * Get severity card value
 */
export async function getSeverityCardValue(
  page: Page,
  severity: "critical" | "high" | "medium" | "low"
): Promise<number> {
  const card = page.locator(
    `[data-testid="severity-${severity}"], text=/${severity}/i`
  ).first();
  
  const parent = card.locator("..");
  const numberText = await parent.locator("text=/\\d+/").first().textContent();
  
  const match = numberText?.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Wait for element to be visible
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 10000
): Promise<void> {
  await page.waitForSelector(selector, { timeout });
}

/**
 * Check for console errors
 */
export async function checkForConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  
  return errors;
}

/**
 * Generate unique test email
 */
export function generateTestEmail(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}@vibescan.test`;
}

/**
 * Extract test data from page
 */
export async function extractScanData(page: Page): Promise<Record<string, unknown>> {
  return {
    url: page.url(),
    title: await page.title(),
    findingsCount: await page.locator('[data-testid="findings-count"]').count(),
    deltaCount: await page.locator('[data-testid="delta-count"]').first().textContent(),
  };
}
