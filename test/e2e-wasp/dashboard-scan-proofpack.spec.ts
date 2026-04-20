import { execFileSync } from "child_process";
import fs from "fs";
import path from "path";
import type { Page } from "@playwright/test";
import { PrismaClient } from "../../wasp-app/node_modules/@prisma/client/index.js";
import { expect, test } from "@playwright/test";
import {
  generateTestEmail,
  loginUser,
  registerUser,
  submitScanFromForm,
  waitForScanCompletion,
} from "./helpers";

const prisma = new PrismaClient();
const repoUrl = "https://github.com/lodash/lodash";
const repoSlug = "lodash/lodash";

type RepoArtifacts = {
  tempDir: string;
  sbomPath: string;
  zipPath: string;
};

async function shot(page: Page, dir: string, name: string) {
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: `${dir}/${name}.png`, fullPage: true });
}

async function acceptCookies(page: Page) {
  const acceptAll = page.getByRole("button", { name: /accept all/i });
  if (await acceptAll.isVisible().catch(() => false)) {
    await acceptAll.click();
  }
}

async function fetchRawPackageJson(repo: string): Promise<string> {
  const branches = ["main", "master"];

  for (const branch of branches) {
    const response = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/package.json`);
    if (response.ok) {
      return response.text();
    }
  }

  throw new Error(`Unable to fetch package.json for ${repo}`);
}

function extractComponents(packageJsonText: string): Array<{ name: string; version: string; type: string }> {
  const parsed = JSON.parse(packageJsonText) as Record<string, any>;
  const dependencyBlocks = [
    parsed.dependencies || {},
    parsed.devDependencies || {},
    parsed.optionalDependencies || {},
    parsed.peerDependencies || {},
  ];

  const components = new Map<string, { name: string; version: string; type: string }>();

  for (const block of dependencyBlocks) {
    for (const [name, version] of Object.entries(block)) {
      const trimmedName = String(name).trim();
      const trimmedVersion = String(version).trim() || "unknown";
      components.set(`${trimmedName}@${trimmedVersion}`, {
        name: trimmedName,
        version: trimmedVersion,
        type: "library",
      });
    }
  }

  return [...components.values()];
}

function writeZip(sourceDir: string, zipPath: string) {
  execFileSync(
    "python3",
    [
      "-c",
      [
        "import os, sys, zipfile",
        "source_dir = sys.argv[1]",
        "zip_path = sys.argv[2]",
        "with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED) as archive:",
        "    for root, _, files in os.walk(source_dir):",
        "        for file_name in files:",
        "            full_path = os.path.join(root, file_name)",
        "            archive.write(full_path, os.path.relpath(full_path, source_dir))",
      ].join("\n"),
      sourceDir,
      zipPath,
    ],
    { stdio: "pipe" },
  );
}

async function buildRepoArtifacts(repo: string): Promise<RepoArtifacts> {
  const artifactsRoot = path.join(process.cwd(), "test-results");
  fs.mkdirSync(artifactsRoot, { recursive: true });
  const tempDir = fs.mkdtempSync(path.join(artifactsRoot, "vibescan-proofpack-"));
  const sourceDir = path.join(tempDir, "source");
  fs.mkdirSync(sourceDir, { recursive: true });

  const packageJsonText = await fetchRawPackageJson(repo);
  const packageJson = JSON.parse(packageJsonText) as Record<string, any>;
  const components = extractComponents(packageJsonText);

  fs.writeFileSync(path.join(sourceDir, "package.json"), JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(
    path.join(sourceDir, "package-lock.json"),
    JSON.stringify(
      {
        name: packageJson.name || "proofpack",
        lockfileVersion: 3,
        packages: {},
      },
      null,
      2,
    ),
  );

  const manifestDir = path.join(sourceDir, "manifests");
  fs.mkdirSync(manifestDir, { recursive: true });
  fs.writeFileSync(
    path.join(manifestDir, "sbom.json"),
    JSON.stringify(
      {
        bomFormat: "CycloneDX",
        specVersion: "1.4",
        version: 1,
        components,
      },
      null,
      2,
    ),
  );

  const zipPath = path.join(tempDir, "repo.zip");
  writeZip(sourceDir, zipPath);

  return {
    tempDir,
    sbomPath: path.join(manifestDir, "sbom.json"),
    zipPath,
  };
}

async function promoteEnterpriseUser(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`Unable to find test user ${email}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      plan: "enterprise",
      subscriptionStatus: "active",
      monthlyQuotaLimit: 1000,
      monthlyQuotaUsed: 0,
    },
  });

  return user.id;
}

test("Dashboard scan proofpack - GitHub, SBOM, ZIP, repeat GitHub", async ({ page }) => {
  test.setTimeout(240_000);

  const email = generateTestEmail("dashboard-proofpack");
  const password = "TestPassword123!";
  const outputDir = "test-results/dashboard-scan-proofpack";
  const artifacts = await buildRepoArtifacts(repoSlug);

  try {
    await registerUser(page, email, password);
    await loginUser(page, email, password);
    const userId = await promoteEnterpriseUser(email);

    await page.goto("/dashboard");
    await acceptCookies(page);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, outputDir, "01-dashboard-empty");

    const githubScanId = await submitScanFromForm(page, repoUrl, "github");
    await page.goto(`/scans/${githubScanId}`);
    await waitForScanCompletion(page);
    await expect(page.getByRole("heading", { name: /scanner summary/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /delta/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, outputDir, "02-github-scan-complete");

    const sbomScanId = await submitScanFromForm(page, artifacts.sbomPath, "sbom");
    await page.goto(`/scans/${sbomScanId}`);
    await waitForScanCompletion(page);
    await expect(page.getByRole("heading", { name: /scanner summary/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /delta/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, outputDir, "03-sbom-scan-complete");

    const zipScanId = await submitScanFromForm(page, artifacts.zipPath, "source_zip");
    await page.goto(`/scans/${zipScanId}`);
    await waitForScanCompletion(page);
    await expect(page.getByRole("heading", { name: /scanner summary/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /delta/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, outputDir, "04-source-zip-scan-complete");

    const repeatScanId = await submitScanFromForm(page, repoUrl, "github");
    await page.goto(`/scans/${repeatScanId}`);
    await waitForScanCompletion(page);
    await expect(page.getByRole("heading", { name: /scanner summary/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /delta/i })).toBeVisible({ timeout: 20_000 });
    await shot(page, outputDir, "05-repeat-github-scan-complete");

    await page.goto("/dashboard");
    await acceptCookies(page);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("table tbody tr")).toHaveCount(4, { timeout: 30_000 });
    await shot(page, outputDir, "06-dashboard-four-scans");
  } finally {
    await prisma.scan.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } });
    fs.rmSync(artifacts.tempDir, { recursive: true, force: true });
    await prisma.$disconnect();
  }
});
