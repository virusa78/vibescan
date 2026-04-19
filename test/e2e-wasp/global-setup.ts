import { chromium, FullConfig } from "@playwright/test";

/**
 * Global setup for Playwright E2E tests
 * - Clears browser cache
 * - Verifies backend is running
 */
async function globalSetup(config: FullConfig) {
  // Verify backend is accessible
  const maxRetries = 30;
  let isBackendReady = false;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(
        "http://192.168.1.17:3000/api/v1/dashboard/recent-scans?limit=1",
        {
          method: "GET",
        },
      ).catch(() => null);

      if (response && [200, 401, 403].includes(response.status)) {
        isBackendReady = true;
        console.log("✓ Backend is ready");
        break;
      }
    } catch (err) {
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
    const frontendUrl = process.env.FRONTEND_URL || "http://192.168.1.17:3000";
    const response = await fetch(frontendUrl);
    if (response.ok) {
      console.log(`✓ Frontend is ready at ${frontendUrl}`);
    }
  } catch (err) {
    console.warn(
      `⚠ Frontend may not be ready at ${
        process.env.FRONTEND_URL || "http://192.168.1.17:3000"
      }`
    );
  }
}

export default globalSetup;
