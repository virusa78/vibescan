import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./test/e2e-wasp",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  globalSetup: "./test/e2e-wasp/global-setup.ts",
  globalTeardown: "./test/e2e-wasp/global-teardown.ts",
  use: {
    baseURL: process.env.FRONTEND_URL || "http://127.0.0.1:3000",
    screenshot: "on",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
