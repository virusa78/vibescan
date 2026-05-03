import { FullConfig } from "@playwright/test";

function getBackendBaseUrl(): string {
  return (
    process.env.API_URL ||
    process.env.WASP_SERVER_URL ||
    "http://127.0.0.1:3555"
  ).replace(/\/$/, "");
}

function getFrontendBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.WASP_WEB_CLIENT_URL ||
    "http://127.0.0.1:3000"
  ).replace(/\/$/, "");
}

/**
 * Global setup for Playwright E2E tests
 * - Clears browser cache
 * - Verifies backend is running
 */
async function globalSetup(_config: FullConfig) {
  // Verify backend is accessible
  const maxRetries = 30;
  let isBackendReady = false;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`${getBackendBaseUrl()}/health`, {
        method: "GET",
      }).catch(() => null);

      if (response && response.ok) {
        isBackendReady = true;
        console.log("✓ Backend is ready");
        break;
      }
    } catch {
      // Backend not ready yet
    }
    
    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  
  if (!isBackendReady) {
    console.warn(
      "⚠ Backend may not be ready. Make sure to run: ./run.sh"
    );
  }
  
  // Test frontend connectivity
  try {
    const frontendUrl = getFrontendBaseUrl();
    const response = await fetch(`${frontendUrl}/login`);
    if (response.ok) {
      console.log(`✓ Frontend is ready at ${frontendUrl}`);
    }
  } catch {
    console.warn(
      `⚠ Frontend may not be ready at ${
        getFrontendBaseUrl()
      }`
    );
  }
}

export default globalSetup;
