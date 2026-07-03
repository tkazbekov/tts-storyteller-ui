"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listActiveJobs } from "@/lib/api";
import { Badge } from "@/components/ui/badge";

const POLL_ACTIVE_MS = 2500;
const POLL_IDLE_MS = 15000;

export function JobsNavLink() {
  const [count, setCount] = useState<number | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      const jobs = await listActiveJobs();
      setCount(jobs.length);
    } catch {
      setCount(0);
    }
  }, []);

  useEffect(() => {
    void fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    const interval = count !== null && count > 0 ? POLL_ACTIVE_MS : POLL_IDLE_MS;
    const t = setInterval(() => {
      // The visibilitychange listener below refreshes on return to the tab.
      if (document.visibilityState === "visible") void fetchCount();
    }, interval);
    return () => clearInterval(t);
  }, [count, fetchCount]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchCount();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchCount]);

  return (
    <Link
      href="/jobs"
      className="text-muted-foreground hover:text-foreground text-sm flex items-center gap-1.5"
    >
      Jobs
      {count !== null && count > 0 && (
        <Badge variant="default" className="h-5 min-w-5 px-1 text-xs">
          {count}
        </Badge>
      )}
    </Link>
  );
}
