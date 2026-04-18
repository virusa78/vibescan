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
      const response = await fetch("http://localhost:3555/health", {
        method: "GET",
      }).catch(() => null);
      
      if (response?.ok) {
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
      "⚠ Backend may not be ready. Make sure to run: PORT=3555 wasp start"
    );
  }
  
  // Test frontend connectivity
  try {
    const frontendUrl = process.env.FRONTEND_URL || "http://127.0.0.1:3000";
    const response = await fetch(frontendUrl);
    if (response.ok) {
      console.log(`✓ Frontend is ready at ${frontendUrl}`);
    }
  } catch (err) {
    console.warn(
      `⚠ Frontend may not be ready at ${
        process.env.FRONTEND_URL || "http://127.0.0.1:3000"
      }`
    );
  }
}

export default globalSetup;
