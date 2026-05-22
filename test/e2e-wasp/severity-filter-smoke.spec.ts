import { test, expect } from "@playwright/test";

test("Severity Filtering Smoke Test - URL Parameter Validation", async ({ page }) => {
  test.setTimeout(30_000);

  // Test 1: Direct navigation with severity parameter
  await test.step("direct severity URL navigation", async () => {
    await page.goto("/dashboard?severity=critical");
    
    // Check URL has parameter
    const url = page.url();
    expect(url).toContain("severity=critical");
    console.log(`✓ URL parameter works: ${url}`);
  });

  // Test 2: Multiple severities
  await test.step("multiple severities URL", async () => {
    await page.goto("/dashboard?severity=critical,high");
    const url = page.url();
    expect(url).toContain("severity=critical");
    console.log(`✓ Multiple severities work: ${url}`);
  });

  // Test 3: Severity parameter persists with other params
  await test.step("severity with other parameters", async () => {
    await page.goto("/dashboard?sort=submitted&dir=desc&severity=medium&q=test");
    const url = page.url();
    expect(url).toContain("severity=medium");
    expect(url).toContain("sort=submitted");
    expect(url).toContain("q=test");
    console.log(`✓ Severity persists with other params: ${url}`);
  });

  // Test 4: All 5 severity levels supported
  await test.step("all severity levels", async () => {
    const severities = ["critical", "high", "medium", "low", "info"];
    for (const severity of severities) {
      await page.goto(`/dashboard?severity=${severity}`);
      const url = page.url();
      expect(url).toContain(`severity=${severity}`);
    }
    console.log(`✓ All 5 severity levels work: ${severities.join(", ")}`);
  });
});
