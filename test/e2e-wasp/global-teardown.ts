import { stopManagedContourIfStarted } from "./managed-contour";

async function globalTeardown(): Promise<void> {
  await stopManagedContourIfStarted();
}

export default globalTeardown;
