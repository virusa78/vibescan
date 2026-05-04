/**
 * Scan Orchestrator - Coordinates dual-scanner pipeline
 * Enqueues both free (Grype) and enterprise (Codescoring) scanners
 * Handles quota deduction and scan state management
 */
import type { OrchestratorInput } from './orchestratorTypes.js';
/**
 * Orchestrate scan submission - enqueue both scanners
 * @param input Scan input parameters
 * @returns Orchestration result with job IDs and queue positions
 */
export declare function orchestrateScan(input: OrchestratorInput): Promise<any>;
/**
 * Get queue status and position for a scan
 */
export declare function getScanQueueStatus(scanId: string): Promise<any>;
/**
 * Cancel a scan and remove it from queues if it is still pending or scanning.
 */
export declare function cancelScan(scanId: string, errorMessage?: string): Promise<{
    scanId: string;
    status: string;
} | null>;
//# sourceMappingURL=orchestrator.d.ts.map