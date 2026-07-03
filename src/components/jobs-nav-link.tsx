"use client";

import Link from "next/link";
import { useActiveJobs } from "@/hooks/use-job-events";
import { Badge } from "@/components/ui/badge";

export function JobsNavLink() {
  const { jobs } = useActiveJobs(15000);
  const count = jobs?.length ?? null;

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
