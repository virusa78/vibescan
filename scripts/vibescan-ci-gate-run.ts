import { readConfig, runVibeScanCIGate } from './vibescan-ci-gate';

async function main(): Promise<void> {
  try {
    const exitCode = await runVibeScanCIGate(readConfig());
    process.exitCode = exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
