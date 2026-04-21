/**
 * Server initialization for queues and workers
 * Call this from your server startup code
 */

import { initializeWorkers, closeWorkers } from './queues/index';
import { startScanTimeoutSweeper, stopScanTimeoutSweeper } from './services/scanTimeoutService.js';
import { startScannerHealthMonitor, stopScannerHealthMonitor } from './services/scannerHealthMonitor.js';

let initialized = false;

export async function initializeServer() {
  if (initialized) {
    console.log('⚠️  Server already initialized');
    return;
  }

  try {
    console.log('🚀 Initializing VibeScan server...');

    // Initialize workers
    await initializeWorkers();
    startScanTimeoutSweeper();
    startScannerHealthMonitor();

    initialized = true;
    console.log('✅ Server initialization complete');
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
    throw error;
  }
}

export async function shutdownServer() {
  if (!initialized) {
    console.log('⚠️  Server not initialized');
    return;
  }

  try {
    console.log('🛑 Shutting down VibeScan server...');

    // Close workers
    await closeWorkers();
    await stopScanTimeoutSweeper();
    stopScannerHealthMonitor();

    initialized = false;
    console.log('✅ Server shutdown complete');
  } catch (error) {
    console.error('❌ Server shutdown failed:', error);
    throw error;
  }
}
