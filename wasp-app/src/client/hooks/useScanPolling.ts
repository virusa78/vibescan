/**
 * useScanPolling Hook
 * Polls scan status every 2 seconds and stops when scan completes or fails
 * Handles rate limiting with exponential backoff
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '../utils/api';

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

interface PollResponse {
  scan: {
    id: string;
    status: string;
    planAtSubmission: string;
    created_at: string;
    completed_at: string | null;
    error_message: string | null;
    inputType: string;
    inputRef: string;
  };
  status: string;
}

const POLL_INTERVAL_MS = 2000; // 2 seconds
const RATE_LIMIT_INITIAL_BACKOFF_MS = 5000; // 5 seconds for first 429
const MAX_BACKOFF_MS = 60000; // Max 60 seconds

/**
 * Hook for polling scan status
 * @param scanId - The scan ID to poll
 * @returns Polling state (scan, isPolling, status, progress, error)
 */
export function useScanPolling(scanId: string) {
  const [state, setState] = useState<ScanPollingState>({
    scan: null,
    isPolling: true,
    status: 'idle',
    progress: 0,
    error: null,
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const backoffRef = useRef(RATE_LIMIT_INITIAL_BACKOFF_MS);
  const abortControllerRef = useRef<AbortController | null>(null);

  const pollScan = useCallback(async () => {
    if (!scanId) return;

    try {
      abortControllerRef.current = new AbortController();
      
      const response = await api.get(`/api/v1/scans/${scanId}`, {
        signal: abortControllerRef.current.signal,
      });

      // Reset backoff on successful response
      backoffRef.current = RATE_LIMIT_INITIAL_BACKOFF_MS;

      const data: PollResponse = response.data;

      if (!data?.scan) {
         throw new Error('Invalid scan response');
       }

       // Determine current status
       const scanStatus = data.scan.status.toLowerCase();
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
          id: data.scan.id,
          status: data.scan.status,
          planAtSubmission: data.scan.planAtSubmission,
          createdAt: new Date(data.scan.created_at),
          completedAt: data.scan.completed_at ? new Date(data.scan.completed_at) : null,
          errorMessage: data.scan.error_message,
          inputType: data.scan.inputType,
          inputRef: data.scan.inputRef,
        },
        isPolling: !isCompleted && !isFailed,
        status: isFailed ? 'failed' : isCompleted ? 'completed' : 'running',
        progress,
        error: isFailed ? data.scan.error_message : null,
      };

      setState(newState);

      // Stop polling if scan is complete or failed
      if (!newState.isPolling && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (err) {
      // Don't set error if aborted (user navigated away)
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }

      const response = typeof err === 'object' && err && 'response' in err
        ? (err as {
            response?: {
              status?: number;
              data?: { message?: string; error?: string };
            };
          }).response
        : undefined;

      if (response?.status === 429) {
        console.warn(`Rate limited polling scan ${scanId}, backing off for ${backoffRef.current}ms`);
        setState(prev => ({
          ...prev,
          error: 'Rate limited - retrying...',
        }));

        await new Promise(resolve => setTimeout(resolve, backoffRef.current));
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        return;
      }

      const errorMsg =
        response?.data?.message ||
        response?.data?.error ||
        (err instanceof Error ? err.message : 'Unknown error');
      console.error(`Polling error for scan ${scanId}:`, errorMsg);
      
      setState(prev => ({
        ...prev,
        error: errorMsg,
        isPolling: false,
        status: 'error',
      }));

      // Stop polling on error
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [scanId]);

  // Setup polling interval
  useEffect(() => {
    if (!scanId) return;

    // Poll immediately on mount
    pollScan();

    // Setup interval for continuous polling
    intervalRef.current = setInterval(pollScan, POLL_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [scanId, pollScan]);

  return state;
}
