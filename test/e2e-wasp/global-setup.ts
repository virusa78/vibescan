import { FullConfig } from "@playwright/test";
import {
  ensureManagedContourStarted,
  isBackendReady,
  isFrontendReady,
  waitForManagedContourReady,
} from "./managed-contour";

/**
 * Global setup for Playwright E2E tests.
 * Verifies the managed Wasp contour is available and auto-starts it when needed.
 */
async function globalSetup(_config: FullConfig) {
  const backendReady = await isBackendReady();
  const frontendReady = await isFrontendReady();

  if (backendReady && frontendReady) {
    console.log("✓ Backend is ready");
    console.log("✓ Frontend is ready");
    return;
  }

  const started = await ensureManagedContourStarted();
  if (started) {
    console.log("✓ Managed Wasp contour started for E2E");
  }

  await waitForManagedContourReady();
  console.log("✓ Backend is ready");
  console.log("✓ Frontend is ready");
}

export default globalSetup;
