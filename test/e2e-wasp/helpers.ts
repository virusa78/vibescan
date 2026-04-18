import { Page, expect } from "@playwright/test";

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
  // Navigate to signup page
  await page.goto("/");
  
  // Click signup link if on landing page
  const signupButton = page.locator('button:has-text("Sign up")').first();
  if (await signupButton.isVisible()) {
    await signupButton.click();
  }
  
  // Wait for signup page to load
  await page.waitForURL(/\/(signup|login)/, { timeout: 5000 });
  
  // Check if we're on login page, click sign up link
  const signUpLink = page.locator('a:has-text("Sign up")');
  if (await signUpLink.isVisible()) {
    await signUpLink.click();
  }
  
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
  await submitButton.click();
  
  // Wait for redirect to dashboard or verification email
  await page.waitForURL(/\/(dashboard|verify-email|email-verification)/, {
    timeout: 10000,
  });
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
  
  // Fill in login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  const submitButton = page.locator('button:has-text("Log in"), button:has-text("Sign in")');
  await submitButton.click();
  
  // Wait for redirect to dashboard
  await page.waitForURL("/dashboard", { timeout: 10000 });
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
  const logoutButton = page.locator('button:has-text("Log out"), button:has-text("Logout"), button:has-text("Sign out")');
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
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check if scan is completed
    const completedIndicator = page.locator('[data-testid="scan-status-completed"]');
    const failedIndicator = page.locator('[data-testid="scan-status-failed"]');
    
    if (await completedIndicator.isVisible()) {
      return true;
    }
    
    if (await failedIndicator.isVisible()) {
      throw new Error("Scan failed");
    }
    
    // Wait before polling again
    await page.waitForTimeout(pollInterval);
    
    // Refresh the page to check for updates
    await page.reload({ waitUntil: "networkidle" });
  }
  
  throw new Error(`Scan did not complete within ${maxWaitTime}ms`);
}

/**
 * Upload a file for scan submission
 */
export async function uploadSbomFile(
  page: Page,
  filePath: string
): Promise<void> {
  // Click "New Scan" button
  const newScanButton = page.locator('button:has-text("New Scan"), button:has-text("Start Scan")').first();
  await newScanButton.click();
  
  // Wait for scan form modal/page
  await page.waitForSelector('[data-testid="scan-form"], form', { timeout: 5000 });
  
  // Select SBOM upload tab
  const sbomTab = page.locator('button:has-text("SBOM"), [role="tab"]:has-text("SBOM")');
  if (await sbomTab.isVisible()) {
    await sbomTab.click();
  }
  
  // Upload file
  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(filePath);
  
  // Wait for file to be selected
  await page.waitForTimeout(500);
  
  // Submit form
  const submitButton = page.locator('button:has-text("Submit"), button:has-text("Start Scan")').last();
  await submitButton.click();
  
  // Wait for scan to be queued
  await page.waitForURL("/dashboard", { timeout: 10000 });
}

/**
 * Click on a scan row to view details
 */
export async function viewScanDetails(page: Page, scanIndex: number = 0): Promise<void> {
  // Get scan row
  const scanRows = page.locator('[data-testid="scan-row"]');
  if (scanIndex >= (await scanRows.count())) {
    throw new Error(`Scan at index ${scanIndex} not found`);
  }
  
  await scanRows.nth(scanIndex).click();
  
  // Wait for scan details page
  await page.waitForSelector('[data-testid="scan-details"]', { timeout: 10000 });
}

/**
 * Verify paywall enforcement for starter plan
 */
export async function verifyScanPaywall(
  page: Page,
  shouldBeLockedForStarter: boolean
): Promise<void> {
  // Check for locked indicators
  const lockedIcon = page.locator('[data-testid="locked-badge"]');
  const lockedMessage = page.locator('text=/locked|premium|requires/i');
  
  if (shouldBeLockedForStarter) {
    // At least one should be visible
    const isLocked =
      (await lockedIcon.count()) > 0 || (await lockedMessage.count()) > 0;
    expect(isLocked).toBeTruthy();
  } else {
    // Full details should be visible (no locked indicators)
    const isLocked =
      (await lockedIcon.count()) > 0 || (await lockedMessage.count()) > 0;
    expect(isLocked).toBeFalsy();
  }
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
export async function extractScanData(page: Page): Promise<Record<string, any>> {
  return {
    url: page.url(),
    title: await page.title(),
    findingsCount: await page.locator('[data-testid="findings-count"]').count(),
    deltaCount: await page.locator('[data-testid="delta-count"]').first().textContent(),
  };
}
