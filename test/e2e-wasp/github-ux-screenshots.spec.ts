import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "../../wasp-app/node_modules/@prisma/client/index.js";
import {
  resolveProjectForScanInput,
  persistProjectFindingsForScan,
} from "../../wasp-app/src/server/services/projectFindingLifecycleService.js";
import { generateTestEmail } from "./helpers";
import { getManagedContourDatabaseUrl } from "./managed-contour";

type SeededUxReviewData = {
  projectId: string;
  findingId: string;
  workspaceId: string;
  email: string;
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

async function dismissCookiesIfPresent(page: Page): Promise<void> {
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

async function seedReviewWorkspace(
  prisma: PrismaClient,
  email: string,
): Promise<SeededUxReviewData> {
  const user = await waitForUserByEmail(prisma, email);

  const suffix = randomUUID().slice(0, 8);
  const now = new Date();
  const organization = await prisma.organization.create({
    data: {
      name: `UX Review Org ${suffix}`,
      slug: `ux-review-org-${suffix}`,
      ownerUserId: user.id,
      isPersonal: true,
    },
  });

  await prisma.organizationMembership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: "owner",
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      organizationId: organization.id,
      name: `UX Review Workspace ${suffix}`,
      slug: `ux-review-workspace-${suffix}`,
      isPersonal: true,
      createdByUserId: user.id,
    },
  });

  await prisma.workspaceMembership.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "admin",
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { activeWorkspaceId: workspace.id },
  });

  const project = await resolveProjectForScanInput(prisma, {
    workspaceId: workspace.id,
    inputType: "github",
    inputRef: `https://github.com/acme/api-${suffix}`,
  });

  await prisma.project.update({
    where: { id: project.id },
    data: { name: `Acme API ${suffix}` },
  });

  const scanCompletedAt = new Date(now.getTime() - 25 * 86_400_000);
  const scan = await prisma.scan.create({
    data: {
      userId: user.id,
      orgId: organization.id,
      workspaceId: workspace.id,
      projectId: project.id,
      inputType: "github",
      inputRef: `https://github.com/acme/api-${suffix}`,
      status: "done",
      completedAt: scanCompletedAt,
      planAtSubmission: "starter",
    },
  });

  await persistProjectFindingsForScan({
    prisma,
    scanId: scan.id,
    source: "grype" as any,
    findings: [
      {
        cveId: "CVE-2024-UX-0001",
        package: "left-pad",
        version: "1.0.0",
        filePath: "package-lock.json",
        severity: "critical",
        cvssScore: 9.8,
        fixedVersion: "1.1.0",
        description: "Prototype pollution in a demo dependency chain.",
      },
    ],
  });

  await persistProjectFindingsForScan({
    prisma,
    scanId: scan.id,
    source: "codescoring_johnny" as any,
    findings: [
      {
        cveId: "CVE-2024-UX-0001",
        package: "left-pad",
        version: "1.0.0",
        filePath: "package-lock.json",
        severity: "critical",
        cvssScore: 9.8,
        fixedVersion: "1.1.0",
        description: "Prototype pollution in a demo dependency chain.",
      },
      {
        cveId: "CVE-2024-UX-0002",
        package: "express",
        version: "4.18.2",
        filePath: "package-lock.json",
        severity: "high",
        cvssScore: 8.1,
        fixedVersion: "4.18.3",
        description: "Routing issue with a reachable request path.",
      },
    ],
  });

  const finding = await prisma.projectFinding.findFirstOrThrow({
    where: {
      projectId: project.id,
      cveId: "CVE-2024-UX-0001",
    },
    select: { id: true },
  });

  return { projectId: project.id, findingId: finding.id, workspaceId: workspace.id, email };
}

test("GitHub UX screenshot pack", async ({ page }) => {
  test.setTimeout(120_000);

  const email = generateTestEmail("github-ux-screens");
  const password = "TestPassword123!";
  const outputDir = "test-results/github-ux-screenshots";
  const databaseUrl = await getManagedContourDatabaseUrl();
  const prisma = new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });

  const pendingReject = { release: null as null | (() => void) };
  let seeded: SeededUxReviewData | null = null;

  try {
    await authenticateViaBrowserFetch(page, email, password);
    seeded = await seedReviewWorkspace(prisma, email);

    await page.goto("/settings", { waitUntil: "domcontentloaded" });
    await dismissCookiesIfPresent(page);
    await expect(page.getByRole("heading", { name: "GitHub Integration" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/GitHub Integration/i)).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByText(/Install and connect GitHub App/i),
    ).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, outputDir, "01-settings-github-integration");

    await page.goto("/findings", { waitUntil: "domcontentloaded" });
    await dismissCookiesIfPresent(page);
    await expect(page.getByRole("heading", { name: /findings/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Acme API/i)).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, outputDir, "02-findings-overview");

    await page.getByRole("button", { name: /Acme API/i }).click();
    await expect(page.getByText(/left-pad/i)).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /CVE-2024-UX-0001/i }).click();
    await expect(page.getByRole("button", { name: /Reject/i })).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, outputDir, "03-findings-drawer");

    pendingReject.release = null;
    const rejectCompletion = new Promise<void>((resolve) => {
      pendingReject.release = resolve;
    });

    await page.route("**/operations/reject-project-finding*", async (route) => {
      await rejectCompletion;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          status: "rejected",
        }),
      });
    });

    await page.getByRole("button", { name: /^Reject$/i }).click();
    await expect(page.getByRole("button", { name: /Rejecting\.\.\./i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Updating finding status\.\.\./i)).toBeVisible({
      timeout: 20_000,
    });
    await shot(page, outputDir, "04-findings-pending-action");

    pendingReject.release?.();
    await page.unroute("**/*");
  } finally {
    pendingReject.release?.();
    await page.unroute("**/operations/reject-project-finding*").catch(() => {});
    if (seeded) {
      await prisma.projectFindingAnnotation.deleteMany({
        where: { projectFinding: { projectId: seeded.projectId } },
      }).catch(() => {});
      await prisma.projectFinding.deleteMany({
        where: { projectId: seeded.projectId },
      }).catch(() => {});
      await prisma.project.deleteMany({
        where: { id: seeded.projectId },
      }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
    await prisma.$disconnect();
  }
});
