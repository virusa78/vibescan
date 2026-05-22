/**
 * useScanPolling Hook
 * Polls scan status every 2 seconds and stops when scan completes or fails
 * Handles rate limiting with exponential backoff
 */
export interface ScanPollingState {
    scan: {
        id: string;
        status: string;
        planAtSubmission: string;
        createdAt: Date;
        completedAt: Date | null;
        errorMessage: string | null;
        inputType: string;
        inputRef: string;
    } | null;
    isPolling: boolean;
    status: 'idle' | 'running' | 'completed' | 'failed' | 'error';
    progress: number;
    error: string | null;
}
/**
 * Hook for polling scan status using Wasp operation
 * @param scanId - The scan ID to poll
 * @returns Polling state (scan, isPolling, status, progress, error)
 */
export declare function useScanPolling(scanId: string): ScanPollingState;
//# sourceMappingURL=useScanPolling.d.ts.map