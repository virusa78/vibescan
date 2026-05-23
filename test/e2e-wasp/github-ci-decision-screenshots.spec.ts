import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "../../wasp-app/node_modules/@prisma/client/index.js";
import { generateTestEmail } from "./helpers";
import { getManagedContourDatabaseUrl } from "./managed-contour";

type SeededCiDecisionScan = {
  scanId: string;
  installationId: bigint;
};

async function shot(page: Page, dir: string, name: string, fullPage = true) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage });
}

async function authenticateViaBrowserFetch(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login", { waitUntil: "domcontentloaded" });

  const signupResult = await page.evaluate(
    async ({ authEmail, authPassword }) => {
      const response = await fetch("/auth/email/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });

      return {
        ok: response.ok,
        status: response.status,
        text: await response.text().catch(() => ""),
      };
    },
    { authEmail: email, authPassword: password },
  );
  expect(signupResult.ok, signupResult.text).toBeTruthy();

  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);

  const loginResponsePromise = page
    .waitForResponse(
      (response) =>
        response.url().includes("/auth/email/login") &&
        response.request().method() === "POST",
      { timeout: 20_000 },
    )
    .catch(() => null);

  await page.locator("form").evaluate((form) => {
    (form as HTMLFormElement).requestSubmit();
  });

  const loginResponse = await loginResponsePromise;
  expect(loginResponse?.ok()).toBeTruthy();

  await page.waitForURL(/\/dashboard(?:[/?#]|$)/, { timeout: 20_000 }).catch(() => {});
}

async function waitForUserByEmail(
  prisma: PrismaClient,
  email: string,
): Promise<{ id: string; activeWorkspaceId: string | null }> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, activeWorkspaceId: true },
    });

    if (user) {
      return user;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Unable to find user row for ${email}`);
}

async function seedCiDecisionScan(
  prisma: PrismaClient,
  email: string,
): Promise<SeededCiDecisionScan> {
  const user = await waitForUserByEmail(prisma, email);
  const scanId = randomUUID();
  const installationId = BigInt(`${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`);
  const completedAt = new Date();
  const scanInputRef = "https://github.com/vibescan/demo-ci-decision";

  try {
    await prisma.githubInstallation.create({
      data: {
        githubInstallationId: installationId,
        githubAppId: "vibescan-demo-app",
        accountLogin: "vibescan-demo",
        accountType: "Organization",
        repositorySelection: "all",
        reposScope: [],
        triggerOnPush: true,
        triggerOnPr: true,
        targetBranches: ["main"],
        failPrOnSeverity: "HIGH",
        workspaceId: user.activeWorkspaceId,
      },
    });

    await prisma.scan.create({
      data: {
        id: scanId,
        userId: user.id,
        workspaceId: user.activeWorkspaceId,
        inputType: "github_app",
        inputRef: scanInputRef,
        githubContext: {
          installationId: installationId.toString(),
          repository: "vibescan/demo-ci-decision",
          deliveryId: `delivery-${scanId}`,
        },
        status: "done",
        completedAt,
        planAtSubmission: "enterprise",
        plannedSources: ["grype", "codescoring_johnny"],
        components: [],
        sbomRaw: {
          bomFormat: "CycloneDX",
          specVersion: "1.4",
          version: 1,
        },
      },
    });

    await prisma.scanResult.createMany({
      data: [
        {
          scanId,
          source: "grype",
          rawOutput: {
            ingestionMeta: {
              resultStatus: "ingested",
              unifiedStats: {
                vulnerabilityCount: 1,
                severityCounts: {
                  critical: 1,
                  high: 0,
                  medium: 0,
                  low: 0,
                  info: 0,
                },
              },
            },
          },
          vulnerabilities: [
            {
              cveId: "CVE-2024-0001",
              severity: "critical",
              packageName: "lodash",
              installedVersion: "4.17.20",
              fixedVersion: "4.17.21",
              source: "grype",
            },
          ],
          scannerVersion: "grype-0.80.0",
          cveDbTimestamp: completedAt,
          durationMs: 1400,
        },
        {
          scanId,
          source: "codescoring_johnny",
          rawOutput: {
            ingestionMeta: {
              resultStatus: "ingested",
              unifiedStats: {
                vulnerabilityCount: 1,
                severityCounts: {
                  critical: 0,
                  high: 1,
                  medium: 0,
                  low: 0,
                  info: 0,
                },
              },
            },
          },
          vulnerabilities: [
            {
              cveId: "CVE-2024-0002",
              severity: "high",
              packageName: "express",
              installedVersion: "4.18.2",
              fixedVersion: "4.18.3",
              source: "codescoring_johnny",
            },
          ],
          scannerVersion: "codescoring-johnny-1.0.0",
          cveDbTimestamp: completedAt,
          durationMs: 2200,
        },
      ],
    });

    await prisma.finding.createMany({
      data: [
        {
          scanId,
          userId: user.id,
          fingerprint: "cve-2024-0001|lodash|4.17.20|package-lock.json",
          cveId: "CVE-2024-0001",
          packageName: "lodash",
          installedVersion: "4.17.20",
          filePath: "package-lock.json",
          severity: "CRITICAL",
          cvssScore: 9.8,
          fixedVersion: "4.17.21",
          status: "active",
          source: "grype",
          description: "Prototype pollution in lodash dependency chain.",
          detectedData: {
            reportedBy: ["grype"],
          },
        },
        {
          scanId,
          userId: user.id,
          fingerprint: "cve-2024-0002|express|4.18.2|package-lock.json",
          cveId: "CVE-2024-0002",
          packageName: "express",
          installedVersion: "4.18.2",
          filePath: "package-lock.json",
          severity: "HIGH",
          cvssScore: 8.1,
          fixedVersion: "4.18.3",
          status: "active",
          source: "codescoring_johnny",
          description: "Routing flaw with reachable request smuggling conditions.",
          detectedData: {
            reportedBy: ["codescoring_johnny"],
          },
        },
      ],
    });

    await prisma.scanDelta.create({
      data: {
        scanId,
        totalFreeCount: 1,
        totalEnterpriseCount: 1,
        deltaCount: 1,
        deltaBySeverity: {
          critical: 1,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
        },
        deltaVulnerabilities: [
          {
            cveId: "CVE-2024-0001",
            severity: "CRITICAL",
            source: "grype",
          },
          {
            cveId: "CVE-2024-0002",
            severity: "HIGH",
            source: "codescoring_johnny",
          },
        ],
        isLocked: false,
        reimportSummary: {
          new_count: 2,
          mitigated_count: 0,
          updated_count: 0,
          unchanged_count: 0,
        },
      },
    });

    return { scanId, installationId };
  } catch (error) {
    await Promise.allSettled([
      prisma.finding.deleteMany({ where: { scanId } }),
      prisma.scanResult.deleteMany({ where: { scanId } }),
      prisma.scanDelta.deleteMany({ where: { scanId } }),
      prisma.scan.deleteMany({ where: { id: scanId } }),
      prisma.githubInstallation.deleteMany({
        where: { githubInstallationId: installationId },
      }),
    ]);

    throw error;
  }
}

test("Scan CI decision screenshots", async ({ page }) => {
  test.setTimeout(120_000);

  const email = generateTestEmail("github-ci-decision");
  const password = "TestPassword123!";
  const outputDir = "test-results/github-ci-decision-screenshots";
  const databaseUrl = await getManagedContourDatabaseUrl();
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  let seeded: SeededCiDecisionScan | null = null;

  try {
    await authenticateViaBrowserFetch(page, email, password);
    seeded = await seedCiDecisionScan(prisma, email);

    await page.setViewportSize({ width: 1440, height: 1600 });

    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('[data-testid="scan-row"]')).toHaveCount(1, {
      timeout: 20_000,
    });
    await shot(page, outputDir, "01-dashboard-with-scan");

    await page.goto(`/scans/${seeded.scanId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("scan-status-completed")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("scanner-summary")).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId("delta-summary")).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, outputDir, "02-scan-details-complete");

    await page.goto(`/reports/${seeded.scanId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /report/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/CI Decision/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Threshold: HIGH \(installation policy\)/i)).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, outputDir, "03-report-overview");

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(250);
    await shot(page, outputDir, "04-report-findings", false);
  } finally {
    if (seeded) {
      await prisma.finding.deleteMany({ where: { scanId: seeded.scanId } });
      await prisma.scanResult.deleteMany({ where: { scanId: seeded.scanId } });
      await prisma.scanDelta.deleteMany({ where: { scanId: seeded.scanId } });
      await prisma.scan.deleteMany({ where: { id: seeded.scanId } });
      await prisma.githubInstallation.deleteMany({
        where: { githubInstallationId: seeded.installationId },
      });
    }

    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  }
});
