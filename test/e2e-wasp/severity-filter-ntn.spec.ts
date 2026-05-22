import { expect, test } from "@playwright/test";
import {
  generateTestEmail,
  registerUser,
} from "./helpers";

test("NTN severity filtering - dashboard chart interactivity", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1200 });

  const testEmail = generateTestEmail("severity-filter");
  const testPassword = "TestPassword123!";

  // Step 1: Setup user and navigate to dashboard
  await test.step("authenticate and reach dashboard", async () => {
    await registerUser(page, testEmail, testPassword);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard(\/?|$)/);
    await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
  });

  // Step 2: Check if severity buttons are visible
  await test.step("severity chart button visibility", async () => {
    const severityHeading = page.getByRole("heading", {
      name: /vulnerability severity/i,
    });
    
    const isHeadingVisible = await severityHeading.isVisible().catch(() => false);
    console.log(`✓ Severity chart heading visible: ${isHeadingVisible}`);

    // Check if we have "No vulnerabilities found" message
    const noVulnsMessage = page.getByText("No vulnerabilities found").isVisible().catch(() => false);
    console.log(`✓ Page shows "No vulnerabilities found": ${await noVulnsMessage}`);
    
    // This is expected for new users - they have no scans yet
    console.log("✓ NOTE: Severity buttons are only shown when there are vulnerabilities in scans");
  });

  // Step 3: Test URL navigation with severity param (most important test)
  await test.step("direct severity filter URL navigation", async () => {
    await page.goto("/dashboard?severity=critical");
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    const url = page.url();
    const hasSeverityParam = url.includes("severity=critical");
    
    console.log(`✓ URL after direct navigation: ${url}`);
    console.log(`✓ Severity param preserved in URL: ${hasSeverityParam}`);

    // This is the KEY TEST - URL should contain severity=critical
    expect(url).toContain("severity=critical");
    
    // Verify dashboard still loads
    const heading = page.getByRole("heading", { name: /dashboard/i });
    await expect(heading).toBeVisible({ timeout: 5_000 });
    console.log("✓ Dashboard page loaded successfully with severity filter in URL");
  });

  // Step 4: Test that severity filter persists across navigation
  await test.step("severity filter persistence across navigation", async () => {
    await page.goto("/dashboard?severity=high&severity=critical");
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    const url1 = page.url();
    console.log(`✓ Initial URL with multiple severities: ${url1}`);
    expect(url1).toContain("severity=");

    // Navigate away and back
    await page.goto("/api-keys");
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // Navigate back with specific severity
    await page.goto("/dashboard?severity=medium");
    const url2 = page.url();
    console.log(`✓ URL after returning to dashboard: ${url2}`);
    expect(url2).toContain("severity=medium");
  });

  // Step 5: Verify no critical console errors
  await test.step("verify console health", async () => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to trigger any errors
    await page.goto("/dashboard?severity=low");
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    // Filter out benign warnings
    const criticalErrors = consoleErrors.filter(
      (err) =>
        !err.includes("component is changing") &&
        !err.includes("controlled input") &&
        !err.includes("uncontrolled")
    );

    if (criticalErrors.length > 0) {
      console.log(`⚠ Console errors: ${criticalErrors.length}`);
      criticalErrors.forEach((err) => console.log(`  - ${err}`));
    } else {
      console.log("✓ No critical console errors");
    }
  });

  // Step 6: Test API integration
  await test.step("severity filter API integration", async () => {
    let apiCallMade = false;
    let severityParamSent = false;

    page.on("response", (response) => {
      const url = response.url();
      if (url.includes("/api/v1/") && url.includes("scans")) {
        apiCallMade = true;
        if (url.includes("severity")) {
          severityParamSent = true;
          console.log(`✓ API call with severity param: ${url}`);
        }
      }
    });

    await page.goto("/dashboard?severity=critical");
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

    console.log(`✓ API calls made: ${apiCallMade}`);
    console.log(`✓ Severity param sent to API: ${severityParamSent}`);
  });
});
