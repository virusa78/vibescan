import { Worker } from 'bullmq';
import { getWorkerRole } from '../config/env.js';
import { getRedisConnectionConfig } from '../config/runtime.js';
import { scannerWorkerDefinitions, type ScannerWorkerRole } from './scannerWorkerRouting.js';

const workerRole = getWorkerRole();
const redisConfig = getRedisConnectionConfig();

async function run() {
  const definition = scannerWorkerDefinitions[workerRole as ScannerWorkerRole];

  if (!definition) {
    throw new Error(
      `Unknown WORKER_ROLE "${process.env.WORKER_ROLE}". Expected one of: ${Object.keys(scannerWorkerDefinitions).join(', ')}`,
    );
  }

  const worker = new Worker(definition.queueName, definition.processor, {
    connection: redisConfig,
    concurrency: definition.concurrency,
  });

  worker.on('completed', (job) => {
    console.log(`[${definition.label}] Job ${job.id} completed`);
  });

  worker.on('failed', (job, error) => {
    console.error(`[${definition.label}] Job ${job?.id ?? 'unknown'} failed:`, error.message);
  });

  const shutdown = async (signal: NodeJS.Signals) => {
    console.log(`[${definition.label}] Received ${signal}, shutting down worker`);
    await worker.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  console.log(
    `[${definition.label}] Worker started for queue ${definition.queueName} with concurrency ${definition.concurrency}`,
  );
}

run().catch((error) => {
  console.error('[Worker Entrypoint] Failed to start worker:', error);
  process.exit(1);
});
