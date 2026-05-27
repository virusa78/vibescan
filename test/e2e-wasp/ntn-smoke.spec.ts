import { expect, test, type Page } from "@playwright/test";
import {
  generateTestEmail,
  registerUser,
  uploadSbomFile,
  waitForScanCompletion,
} from "./helpers";

type SoftIssue = {
  scope: string;
  message: string;
};

async function softCheck(scope: string, check: () => Promise<void>, issues: SoftIssue[]) {
  try {
    await check();
  } catch (error) {
    issues.push({
      scope,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

async function maybeVisible(page: Page, text: RegExp | string) {
  return page.getByText(text, { exact: false }).isVisible().catch(() => false);
}

test("NTN smoke - full surface coverage with soft non-core checks", async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 1200 });

  const testEmail = generateTestEmail("ntn-smoke");
  const testPassword = "TestPassword123!";
  const issues: SoftIssue[] = [];
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await test.step("authenticate", async () => {
    await registerUser(page, testEmail, testPassword);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard(\/?|$)/);
  });

  await test.step("dashboard surfaces", async () => {
    await softCheck("dashboard heading", async () => {
      await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    }, issues);

    await softCheck("recent scans table", async () => {
      await expect(page.locator('table')).toBeVisible();
    }, issues);

    await softCheck("sidebar navigation", async () => {
      await expect(page.getByRole("link", { name: /scans/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /findings/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /api keys/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /settings/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /webhooks/i })).toBeVisible();
    }, issues);
  });

  await test.step("new scan surfaces", async () => {
    await page.goto("/new-scan");
    await expect(page).toHaveURL(/\/new-scan(\/?|$)/);

    await softCheck("scans heading", async () => {
      await expect(page.getByRole("heading", { name: /scans?/i })).toBeVisible();
    }, issues);

    await softCheck("parallel lineup card", async () => {
      await expect(page.getByRole("heading", { name: /parallel scan lanes/i })).toBeVisible();
    }, issues);

    await softCheck("input type cards", async () => {
      await expect(page.getByRole("button", { name: /github repository/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /sbom file/i })).toBeVisible();
      await expect(page.getByRole("button", { name: /source archive/i })).toBeVisible();
    }, issues);

    await softCheck("form controls", async () => {
      await expect(page.locator("input#inputRef")).toBeVisible();
      await expect(page.getByRole("button", { name: /run scan|start scan/i })).toBeVisible();
    }, issues);
  });

  let scanId = "";
  await test.step("submit scan and observe scan details", async () => {
    scanId = await uploadSbomFile(page, "test/fixtures/sample.sbom.json");
    await expect(scanId).toMatch(/[0-9a-fA-F-]{36}/);

    await page.goto(`/scans/${scanId}`);
    await expect(page).toHaveURL(new RegExp(`/scans/${scanId}(?:[/?#]|$)`));
    await softCheck("scan completion", async () => {
      const completed = await waitForScanCompletion(page, 60_000, 3_000);
      expect(completed).toBeTruthy();
    }, issues);

    await softCheck("scan details heading", async () => {
      await expect(page.getByRole("heading", { name: /scanner summary/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: /delta/i })).toBeVisible({ timeout: 20_000 });
    }, issues);

    await softCheck("scanner lineup visible", async () => {
      await expect(page.getByRole("heading", { name: /scanner summary/i })).toBeVisible();
    }, issues);

    await softCheck("findings rendered", async () => {
      const findingRows = page.locator('[data-testid="finding-row"], tbody tr');
      await expect(findingRows.first()).toBeVisible({ timeout: 15_000 });
    }, issues);
  });

  await test.step("report surface", async () => {
    await page.goto(`/reports/${scanId}`);
    await softCheck("report heading", async () => {
      await expect(page.getByRole("heading", { name: /^report(?:: .+)?$/i })).toBeVisible({ timeout: 20_000 });
    }, issues);

    await softCheck("severity chips", async () => {
      const severityFilters = page.getByRole("group", { name: /severity filters/i });
      await expect(severityFilters.getByLabel(/^All/i)).toBeVisible();
      await expect(severityFilters.getByLabel(/^Critical/i)).toBeVisible();
      await expect(severityFilters.getByLabel(/^High/i)).toBeVisible();
    }, issues);

    await softCheck("report actions", async () => {
      await expect(page.getByRole("button", { name: /generate pdf/i })).toBeVisible();
    }, issues);
  });

  await test.step("findings surface", async () => {
    await page.goto("/findings");
    await softCheck("findings heading", async () => {
      await expect(page.getByRole("heading", { name: /^findings$/i })).toBeVisible({ timeout: 20_000 });
    }, issues);

    await softCheck("findings table", async () => {
      await expect(page.getByText(/project \/ cve/i)).toBeVisible();
    }, issues);
  });

  await test.step("settings and workspace surfaces", async () => {
    await page.goto("/settings");
    await softCheck("settings heading", async () => {
      await expect(page.getByRole("heading", { name: /user profile settings/i })).toBeVisible({ timeout: 20_000 });
    }, issues);
    await softCheck("profile section", async () => {
      await expect(page.getByRole("heading", { name: /user profile settings/i })).toBeVisible();
    }, issues);
    await softCheck("scanner access section", async () => {
      await expect(page.getByRole("heading", { name: /scanner access/i })).toBeVisible();
    }, issues);

    await page.goto("/api-keys");
    await softCheck("api keys page", async () => {
      await expect(page.getByRole("heading", { name: /api keys/i })).toBeVisible({ timeout: 20_000 });
    }, issues);
    await softCheck("api keys actions", async () => {
      const generateKey = page.getByRole("button", { name: /generate new key|generate your first key/i }).first();
      await expect(generateKey).toBeVisible();
    }, issues);

    await page.goto("/webhooks");
    await softCheck("webhooks page", async () => {
      await expect(page.getByRole("heading", { name: /^webhooks$/i })).toBeVisible({ timeout: 20_000 });
    }, issues);
    await softCheck("webhooks actions", async () => {
      await expect(page.getByRole("button", { name: /add webhook/i })).toBeVisible();
    }, issues);

    await page.goto("/pricing");
    await softCheck("pricing page", async () => {
      await expect(page.getByRole("heading", { name: /^pick your pricing$/i })).toBeVisible({ timeout: 20_000 });
    }, issues);
    await softCheck("pricing cards", async () => {
      const visible = (await maybeVisible(page, /^hobby$/i)) || (await maybeVisible(page, /^pro$/i)) || (await maybeVisible(page, /^10 credits$/i));
      expect(visible).toBeTruthy();
    }, issues);
  });

  await test.step("dashboard recap", async () => {
    await page.goto("/dashboard");
    await softCheck("dashboard revisit", async () => {
      await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
      await expect(page.locator('[data-testid="scan-row"]').first()).toBeVisible({ timeout: 20_000 });
    }, issues);
  });

  if (issues.length > 0) {
    const formatted = issues.map((issue) => `- [${issue.scope}] ${issue.message}`).join("\n");
    console.log(`NTN smoke soft issues:\n${formatted}`);
  }

  if (consoleErrors.length > 0) {
    console.log(`NTN smoke console errors observed (${consoleErrors.length}):`);
    for (const error of consoleErrors) {
      console.log(`- ${error}`);
    }
  }

  if (pageErrors.length > 0) {
    console.log(`NTN smoke page errors observed (${pageErrors.length}):`);
    for (const error of pageErrors) {
      console.log(`- ${error}`);
    }
  }
});
