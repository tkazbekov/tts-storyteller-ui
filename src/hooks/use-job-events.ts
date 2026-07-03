"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getJob, listActiveJobs } from "@/lib/api";
import type { Job } from "@/lib/api-types";
import { subscribeJobEvents } from "@/lib/job-events";
import { useJobPolling } from "@/hooks/use-job-polling";

type JobWatcherCallbacks = {
  onUpdate?: (job: Job) => void;
  onSucceeded?: (job: Job) => void;
  onFailed?: (job: Job) => void;
  onError?: (err: unknown) => void;
};

/**
 * Watch a single job until it reaches a terminal state — drop-in replacement
 * for useJobPolling's { start, stop } contract, driven by the shared SSE
 * stream with useJobPolling as the fallback engine.
 */
export function useJobWatcher() {
  const polling = useJobPolling();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    polling.stop();
  }, [polling]);

  useEffect(() => stop, [stop]);

  const start = useCallback(
    (jobId: string, callbacks: JobWatcherCallbacks) => {
      stop();
      let done = false;

      const finish = (job: Job) => {
        if (done) return;
        done = true;
        unsubscribeRef.current?.();
        unsubscribeRef.current = null;
        if (job.status === "succeeded") callbacks.onSucceeded?.(job);
        else callbacks.onFailed?.(job);
      };

      const handle = (job: Job) => {
        if (done) return;
        callbacks.onUpdate?.(job);
        if (job.status === "succeeded" || job.status === "failed") finish(job);
      };

      const resolveViaFetch = () => {
        getJob(jobId)
          .then((job) => {
            if (done) return;
            if (job.status === "succeeded" || job.status === "failed") {
              callbacks.onUpdate?.(job);
              finish(job);
            }
          })
          .catch((err) => {
            if (done) return;
            done = true;
            unsubscribeRef.current?.();
            unsubscribeRef.current = null;
            callbacks.onError?.(err);
          });
      };

      unsubscribeRef.current = subscribeJobEvents((ev) => {
        if (done) return;
        if (ev.type === "job" && ev.job.id === jobId) {
          handle(ev.job);
        } else if (ev.type === "snapshot") {
          const job = ev.jobs.find((j) => j.id === jobId);
          if (job) {
            callbacks.onUpdate?.(job);
          } else {
            // A reconnect gap may have swallowed the terminal event;
            // resolve the final state once via fetch.
            resolveViaFetch();
          }
        } else if (ev.type === "fallback") {
          unsubscribeRef.current?.();
          unsubscribeRef.current = null;
          polling.start(jobId, callbacks);
        }
      });

      // Seed fetch: the job may have gone terminal before we subscribed
      // (terminal jobs never appear in snapshots).
      resolveViaFetch();
    },
    [polling, stop]
  );

  return { start, stop };
}

/**
 * Live list of active jobs for list consumers (jobs page, nav badge),
 * driven by the shared SSE stream; degrades to visibility-gated polling.
 */
export function useActiveJobs(pollIntervalMs: number = 3000): {
  jobs: Job[] | null;
  degraded: boolean;
} {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [degraded, setDegraded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeJobEvents((ev) => {
      if (ev.type === "snapshot") {
        setJobs(ev.jobs);
      } else if (ev.type === "job") {
        setJobs((prev) => {
          const next = (prev ?? []).filter((j) => j.id !== ev.job.id);
          if (ev.job.status === "queued" || ev.job.status === "running") {
            next.push(ev.job);
          }
          return next;
        });
      } else if (ev.type === "fallback") {
        setDegraded(true);
      }
    });
    return unsubscribe;
  }, []);

  // Degraded mode: the pre-SSE polling behavior.
  useEffect(() => {
    if (!degraded) return;

    const fetchJobs = () => {
      listActiveJobs()
        .then(setJobs)
        .catch(() => setJobs((prev) => prev ?? []));
    };

    fetchJobs();
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchJobs();
    }, pollIntervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchJobs();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [degraded, pollIntervalMs]);

  return { jobs, degraded };
}
