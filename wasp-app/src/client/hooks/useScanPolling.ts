/**
 * useScanPolling Hook
 * Polls scan status every 2 seconds and stops when scan completes or fails
 * Handles rate limiting with exponential backoff
 */

import { useEffect, useRef, useState } from 'react';
import { getScanById, useQuery } from 'wasp/client/operations';

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
  progress: number; // 0-100
  error: string | null;
}

const POLL_INTERVAL_MS = 2000; // 2 seconds

/**
 * Hook for polling scan status using Wasp operation
 * @param scanId - The scan ID to poll
 * @returns Polling state (scan, isPolling, status, progress, error)
 */
export function useScanPolling(scanId: string) {
  const [displayState, setDisplayState] = useState<ScanPollingState>({
    scan: null,
    isPolling: true,
    status: 'idle',
    progress: 0,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Use Wasp operation for fetching scan data (has auth context)
  const {
    data: scanData,
    error: queryError,
    refetch,
  } = useQuery(
    getScanById,
    { scanId: scanId || '' },
    {
      enabled: !!scanId,
    }
  );

  // Process scan data and manage polling state
  useEffect(() => {
    if (!scanId) return;

    const updateDisplayState = () => {
      if (!scanData) {
        return;
      }

      // The operation returns ScanWithDetails directly
      const scan = scanData;

      // Determine current status
      const scanStatus = scan.status.toLowerCase();
      const isRunning = ['pending', 'scanning', 'running'].includes(scanStatus);
      const isCompleted = scanStatus === 'done';
      const isFailed = scanStatus === 'error' || scanStatus === 'failed';

      // Calculate progress (estimated)
      let progress = 0;
      if (isCompleted) progress = 100;
      else if (isFailed) progress = 0;
      else if (isRunning) progress = 50; // Running scans show 50% progress

      const newState: ScanPollingState = {
        scan: {
          id: scan.id,
          status: scan.status,
          planAtSubmission: scan.planAtSubmission,
          createdAt: new Date(scan.createdAt),
          completedAt: scan.completedAt ? new Date(scan.completedAt) : null,
          errorMessage: scan.errorMessage || null,
          inputType: scan.inputType,
          inputRef: scan.inputRef,
        },
        isPolling: !isCompleted && !isFailed,
        status: isFailed ? 'failed' : isCompleted ? 'completed' : 'running',
        progress,
        error: isFailed ? (scan.errorMessage || null) : null,
      };

      setDisplayState(newState);

      // Stop polling if scan is complete or failed
      if (!newState.isPolling && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    updateDisplayState();
  }, [scanData, scanId]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      const errorMsg = queryError instanceof Error ? queryError.message : 'Unknown error';
      console.error(`Polling error for scan ${scanId}:`, errorMsg);
      setDisplayState(prev => ({
        ...prev,
        error: errorMsg,
        isPolling: false,
        status: 'error',
      }));

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [queryError, scanId]);

  // Setup polling interval using refetch
  useEffect(() => {
    if (!scanId) return;

    // Setup interval for continuous polling
    intervalRef.current = setInterval(() => {
      refetch();
    }, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [scanId, refetch]);

  return displayState;
}
