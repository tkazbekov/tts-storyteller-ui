/**
 * Shared subscription manager for the backend's GET /jobs/events SSE stream.
 *
 * One EventSource per page regardless of subscriber count (ref-counted; the
 * last unsubscribe closes it). Late subscribers get a synthetic snapshot from
 * the cached active-jobs map. Persistent stream failure emits a sticky
 * `fallback` event, after which consumers are expected to poll instead —
 * this also covers backends that predate the /jobs/events endpoint (404 →
 * EventSource CLOSED → immediate fallback).
 */

import { buildUrl } from "./api";
import type { Job, JobStreamEvent } from "./api-types";

type Listener = (ev: JobStreamEvent) => void;

const MAX_ERRORS_BEFORE_FALLBACK = 3;

let source: EventSource | null = null;
let listeners = new Set<Listener>();
let activeJobs: Map<string, Job> | null = null; // null until the first snapshot
let consecutiveErrors = 0;
let degraded = false; // sticky for the page lifetime

function emit(ev: JobStreamEvent) {
  for (const listener of [...listeners]) listener(ev);
}

function close() {
  source?.close();
  source = null;
  activeJobs = null;
}

function open() {
  source = new EventSource(buildUrl("/jobs/events"));

  source.addEventListener("open", () => {
    consecutiveErrors = 0;
  });

  source.addEventListener("snapshot", (e) => {
    const jobs = JSON.parse((e as MessageEvent).data) as Job[];
    activeJobs = new Map(jobs.map((j) => [j.id, j]));
    emit({ type: "snapshot", jobs });
  });

  source.addEventListener("job", (e) => {
    const job = JSON.parse((e as MessageEvent).data) as Job;
    if (activeJobs) {
      if (job.status === "queued" || job.status === "running") {
        activeJobs.set(job.id, job);
      } else {
        activeJobs.delete(job.id);
      }
    }
    emit({ type: "job", job });
  });

  source.addEventListener("error", () => {
    consecutiveErrors += 1;
    // CLOSED means the browser gave up (e.g. the endpoint returned non-200:
    // no auto-retry happens); repeated errors without a successful open mean
    // the backend is unreachable. Either way: degrade to polling.
    const fatal = source?.readyState === EventSource.CLOSED;
    if (fatal || consecutiveErrors >= MAX_ERRORS_BEFORE_FALLBACK) {
      close();
      degraded = true;
      emit({ type: "fallback" });
    }
    // Otherwise EventSource auto-reconnects; the reconnect's fresh snapshot
    // self-heals any missed events.
  });
}

/** Subscribe to the shared job stream. Returns an unsubscribe function. */
export function subscribeJobEvents(listener: Listener): () => void {
  listeners.add(listener);
  if (degraded) {
    queueMicrotask(() => listener({ type: "fallback" }));
  } else if (!source) {
    open();
  } else if (activeJobs) {
    // Late subscriber: deliver current state without waiting for the next event.
    const jobs = [...activeJobs.values()];
    queueMicrotask(() => listener({ type: "snapshot", jobs }));
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) close();
  };
}

/** Test-only reset hook. */
export function _resetJobEvents() {
  close();
  listeners = new Set();
  degraded = false;
  consecutiveErrors = 0;
}
