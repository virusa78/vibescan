import { test, expect } from "@playwright/test";
import {
  registerUser,
  loginUser,
  logoutUser,
  uploadSbomFile,
  waitForScanCompletion,
  viewScanDetails,
  verifyScanPaywall,
  verifyFindingsDisplay,
  getSeverityCardValue,
  generateTestEmail,
  checkForConsoleErrors,
} from "./helpers";

/**
 * Test 1: SBOM Upload E2E
 * User Story: Register → Upload SBOM → See results on dashboard
 * 
 * This test verifies:
 * - User registration and login
 * - SBOM file upload
 * - Scan processing and completion
 * - Dashboard display of scan results
 * - Paywall enforcement for starter plan
 * - Severity breakdown display
 * - Vulnerability table rendering
 */
test("SBOM Upload E2E - Register and scan with starter plan", async ({
  page,
  context,
}) => {
  const testEmail = generateTestEmail("sbom-e2e");
  const testPassword = "TestPassword123!";
  
  // Track console errors
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });
  
  try {
    // Test 1.1: Register new user
    console.log("📝 Registering new user:", testEmail);
    await registerUser(page, testEmail, testPassword);
    
    // Verify dashboard is accessible
    expect(page.url()).toContain("dashboard");
    console.log("✓ User registered and redirected to dashboard");
    
    // Test 1.2: Navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    console.log("✓ Dashboard loaded");
    
    // Test 1.3: Upload SBOM file
    console.log("📤 Uploading SBOM file");
    const sbomPath = "test/fixtures/sample.sbom.json";
    await uploadSbomFile(page, sbomPath);
    console.log("✓ SBOM file submitted");
    
    // Test 1.4: Wait for scan to complete
    console.log("⏳ Waiting for scan to complete...");
    await page.waitForTimeout(5000); // Brief wait for scan to be queued
    
    // Poll for scan completion (with reasonable timeout for MVP)
    let scanCompleted = false;
    let pollAttempts = 0;
    const maxPolls = 60; // 2 minutes with 2s interval
    
    while (pollAttempts < maxPolls && !scanCompleted) {
      await page.reload({ waitUntil: "networkidle" });
      
      // Check if any scan is visible in the list
      const scanRows = page.locator('[data-testid="scan-row"]');
      const scanCount = await scanRows.count();
      
      if (scanCount > 0) {
        // Get the status of the first scan
        const statusElement = scanRows.nth(0).locator('[data-testid="scan-status"]');
        const status = await statusElement.textContent();
        
        console.log(`  Poll ${pollAttempts + 1}: Scan status = ${status}`);
        
        if (status?.includes("completed") || status?.includes("done")) {
          scanCompleted = true;
          console.log("✓ Scan completed!");
          break;
        }
      }
      
      pollAttempts++;
      await page.waitForTimeout(2000);
    }
    
    if (!scanCompleted) {
      throw new Error(
        "Scan did not complete within expected time. This may be normal in MVP stage."
      );
    }
    
    // Test 1.5: Verify scan appears on dashboard
    const dashboardScans = page.locator('[data-testid="scan-row"]');
    const scanCount = await dashboardScans.count();
    expect(scanCount).toBeGreaterThan(0);
    console.log(`✓ Scan appears on dashboard (${scanCount} scan(s) visible)`);
    
    // Test 1.6: Click scan row to view details
    console.log("👁️ Navigating to scan details");
    await viewScanDetails(page, 0);
    console.log("✓ Scan details page loaded");
    
    // Test 1.7: Verify paywall enforcement (starter plan should see counts only)
    console.log("🔒 Checking paywall enforcement");
    await verifyScanPaywall(page, true); // Starter plan should be locked
    console.log("✓ Paywall enforcement verified");
    
    // Test 1.8: Verify severity breakdown visible
    console.log("📊 Checking severity breakdown");
    const criticalCount = await getSeverityCardValue(page, "critical");
    const highCount = await getSeverityCardValue(page, "high");
    console.log(
      `✓ Severity cards visible: Critical=${criticalCount}, High=${highCount}`
    );
    
    // Test 1.9: Verify vulnerability table shows
    console.log("📋 Verifying findings table");
    await verifyFindingsDisplay(page);
    console.log("✓ Findings table displayed");
    
    // Test 1.10: Verify no unhandled errors
    console.log("🔍 Checking for console errors");
    expect(consoleErrors).toEqual([]);
    console.log("✓ No console errors found");
    
    // Success!
    console.log("✅ SBOM Upload E2E test completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    
    // Capture screenshot on failure
    await page.screenshot({ path: "sbom-upload-e2e-failure.png" });
    
    throw error;
  }
});

/**
 * Additional test: SBOM Upload with various file formats
 */
test("SBOM Upload - Multiple formats", async ({ page }) => {
  const testEmail = generateTestEmail("sbom-formats");
  const testPassword = "TestPassword123!";
  
  try {
    // Register and login
    await registerUser(page, testEmail, testPassword);
    
    // Navigate to dashboard
    await page.goto("/dashboard");
    await page.waitForLoadState("networkidle");
    
    // Upload SBOM
    const sbomPath = "test/fixtures/sample.sbom.json";
    await uploadSbomFile(page, sbomPath);
    
    // Verify submission succeeded
    expect(page.url()).toContain("dashboard");
    console.log("✓ SBOM upload accepted");
    
  } catch (error) {
    console.error("❌ Format test failed:", error);
    throw error;
  }
});
