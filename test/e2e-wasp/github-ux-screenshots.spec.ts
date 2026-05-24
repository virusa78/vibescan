import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "../../wasp-app/node_modules/@prisma/client/index.js";
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
  if (!user.activeWorkspaceId) {
    throw new Error(`User ${email} does not have an active workspace`);
  }

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

  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: `Acme API ${suffix}`,
      slug: `acme-api-${suffix}`,
      targetType: "github",
      targetRef: "https://github.com/acme/api",
      normalizedTargetRef: `https://github.com/acme/api#${suffix}`,
      metadata: {},
    },
  });

  const finding = await prisma.projectFinding.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      fingerprint: `cve-2024-ux-${suffix}|left-pad|1.0.0|package-lock.json`,
      cveId: "CVE-2024-UX-0001",
      packageName: "left-pad",
      installedVersion: "1.0.0",
      filePath: "package-lock.json",
      severity: "CRITICAL",
      cvssScore: "9.8",
      fixedVersion: "1.1.0",
      description: "Prototype pollution in a demo dependency chain.",
      status: "active",
      firstSeenAt: new Date(now.getTime() - 14 * 86_400_000),
      lastSeenAt: now,
      lastDetectedAt: now,
      scanCount: 4,
      reportedBy: ["grype", "codescoring_johnny"],
      firstDetectedBy: "grype",
      lastDetectedBy: "codescoring_johnny",
      slaDueAt: new Date(now.getTime() - 2 * 86_400_000),
      slaState: "overdue",
      metadata: {},
    },
  });

  await prisma.projectFinding.create({
    data: {
      workspaceId: workspace.id,
      projectId: project.id,
      fingerprint: `cve-2024-ux-${suffix}|express|4.18.2|package-lock.json`,
      cveId: "CVE-2024-UX-0002",
      packageName: "express",
      installedVersion: "4.18.2",
      filePath: "package-lock.json",
      severity: "HIGH",
      cvssScore: "8.1",
      fixedVersion: "4.18.3",
      description: "Routing issue with a reachable request path.",
      status: "active",
      firstSeenAt: new Date(now.getTime() - 45 * 86_400_000),
      lastSeenAt: now,
      lastDetectedAt: now,
      scanCount: 2,
      reportedBy: ["codescoring_johnny"],
      firstDetectedBy: "codescoring_johnny",
      lastDetectedBy: "codescoring_johnny",
      slaDueAt: new Date(now.getTime() + 5 * 86_400_000),
      slaState: "due_soon",
      metadata: {},
    },
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
        where: { projectFindingId: seeded.findingId },
      }).catch(() => {});
      await prisma.projectFinding.deleteMany({
        where: { id: seeded.findingId },
      }).catch(() => {});
      await prisma.project.deleteMany({
        where: { id: seeded.projectId },
      }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { email } }).catch(() => {});
    await prisma.$disconnect();
  }
});
