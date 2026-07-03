"use client";

import { useCallback, useEffect, useRef } from "react";
import { getJob } from "@/lib/api";
import type { Job } from "@/lib/api-types";

const DEFAULT_INTERVAL_MS = 2500;

type JobPollingCallbacks = {
  /** Called on every poll tick with the latest job state. */
  onUpdate?: (job: Job) => void;
  onSucceeded?: (job: Job) => void;
  onFailed?: (job: Job) => void;
  /** Called when polling itself fails (network/API error). */
  onError?: (err: unknown) => void;
};

/**
 * Polls a job until it reaches a terminal state.
 *
 * Owns the timer: starting a new poll stops the previous one, and unmounting
 * the component stops polling entirely (no state updates after unmount).
 */
export function useJobPolling(intervalMs: number = DEFAULT_INTERVAL_MS) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (jobId: string, callbacks: JobPollingCallbacks) => {
      stop();
      activeRef.current = true;

      const tick = async () => {
        if (!activeRef.current) return;
        try {
          const job = await getJob(jobId);
          if (!activeRef.current) return;
          callbacks.onUpdate?.(job);
          if (job.status === "succeeded") {
            activeRef.current = false;
            callbacks.onSucceeded?.(job);
            return;
          }
          if (job.status === "failed") {
            activeRef.current = false;
            callbacks.onFailed?.(job);
            return;
          }
          timerRef.current = setTimeout(tick, intervalMs);
        } catch (err) {
          if (!activeRef.current) return;
          activeRef.current = false;
          callbacks.onError?.(err);
        }
      };

      timerRef.current = setTimeout(tick, intervalMs);
    },
    [intervalMs, stop]
  );

  return { start, stop };
}
