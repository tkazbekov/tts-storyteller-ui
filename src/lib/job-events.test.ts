import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetJobEvents, subscribeJobEvents } from "./job-events";
import type { Job, JobStreamEvent } from "./api-types";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = FakeEventSource.CONNECTING;
  closed = false;
  listeners = new Map<string, Set<(e: MessageEvent) => void>>();

  constructor(public url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  close() {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }

  dispatch(type: string, data?: unknown) {
    for (const cb of this.listeners.get(type) ?? []) {
      cb({ data: data !== undefined ? JSON.stringify(data) : undefined } as MessageEvent);
    }
  }
}

function makeJob(id: string, status: Job["status"]): Job {
  return {
    id,
    type: "generate",
    status,
    storyId: "template",
    voiceId: null,
    message: null,
    outputPath: null,
    requestParams: {},
    createdAt: "2026-01-01T00:00:00+00:00",
    startedAt: null,
    finishedAt: null,
  };
}

async function flushMicrotasks() {
  await Promise.resolve();
}

beforeEach(() => {
  FakeEventSource.instances = [];
  vi.stubGlobal("EventSource", FakeEventSource);
});

afterEach(() => {
  _resetJobEvents();
  vi.unstubAllGlobals();
});

describe("subscribeJobEvents", () => {
  it("opens exactly one connection for multiple subscribers", () => {
    const unsub1 = subscribeJobEvents(() => {});
    const unsub2 = subscribeJobEvents(() => {});

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain("/jobs/events");
    unsub1();
    unsub2();
  });

  it("delivers snapshots to all listeners", () => {
    const seen1: JobStreamEvent[] = [];
    const seen2: JobStreamEvent[] = [];
    subscribeJobEvents((ev) => seen1.push(ev));
    subscribeJobEvents((ev) => seen2.push(ev));

    const jobs = [makeJob("a", "queued")];
    FakeEventSource.instances[0].dispatch("snapshot", jobs);

    expect(seen1).toEqual([{ type: "snapshot", jobs }]);
    expect(seen2).toEqual([{ type: "snapshot", jobs }]);
  });

  it("gives late subscribers a synthetic snapshot reflecting applied job events", async () => {
    subscribeJobEvents(() => {});
    const source = FakeEventSource.instances[0];
    source.dispatch("snapshot", [makeJob("a", "queued"), makeJob("b", "queued")]);
    source.dispatch("job", makeJob("a", "running")); // upsert
    source.dispatch("job", makeJob("b", "succeeded")); // remove

    const seen: JobStreamEvent[] = [];
    subscribeJobEvents((ev) => seen.push(ev));
    await flushMicrotasks();

    expect(seen).toHaveLength(1);
    const snapshot = seen[0] as Extract<JobStreamEvent, { type: "snapshot" }>;
    expect(snapshot.jobs.map((j) => [j.id, j.status])).toEqual([["a", "running"]]);
  });

  it("closes on last unsubscribe and reopens for a new subscriber", () => {
    const unsub = subscribeJobEvents(() => {});
    expect(FakeEventSource.instances).toHaveLength(1);

    unsub();
    expect(FakeEventSource.instances[0].closed).toBe(true);

    subscribeJobEvents(() => {});
    expect(FakeEventSource.instances).toHaveLength(2);
  });

  it("falls back immediately on a fatal (CLOSED) error and stays degraded", async () => {
    const seen: JobStreamEvent[] = [];
    subscribeJobEvents((ev) => seen.push(ev));

    const source = FakeEventSource.instances[0];
    source.readyState = FakeEventSource.CLOSED; // e.g. endpoint returned 404
    source.dispatch("error");

    expect(seen).toEqual([{ type: "fallback" }]);

    // New subscribers on a degraded manager get fallback right away.
    const late: JobStreamEvent[] = [];
    subscribeJobEvents((ev) => late.push(ev));
    await flushMicrotasks();
    expect(late).toEqual([{ type: "fallback" }]);
    expect(FakeEventSource.instances).toHaveLength(1); // never reopened
  });

  it("falls back after repeated errors without a successful open", () => {
    const seen: JobStreamEvent[] = [];
    subscribeJobEvents((ev) => seen.push(ev));
    const source = FakeEventSource.instances[0];

    source.dispatch("error");
    source.dispatch("error");
    expect(seen).toEqual([]); // still retrying via EventSource auto-reconnect

    source.dispatch("error");
    expect(seen).toEqual([{ type: "fallback" }]);
  });

  it("resets the error counter on open", () => {
    const seen: JobStreamEvent[] = [];
    subscribeJobEvents((ev) => seen.push(ev));
    const source = FakeEventSource.instances[0];

    source.dispatch("error");
    source.dispatch("error");
    source.dispatch("open");
    source.dispatch("error");
    source.dispatch("error");

    expect(seen).toEqual([]); // counter reset — no fallback yet
  });
});
