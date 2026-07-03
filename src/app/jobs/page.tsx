"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ApiError, listActiveJobs, cancelJob } from "@/lib/api";
import type { Job } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const POLL_INTERVAL_MS = 3000;

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const list = await listActiveJobs();
      setJobs(list);
    } catch {
      toast.error("Failed to load jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (jobs.length === 0) return;
    const t = setInterval(fetchJobs, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [jobs.length, fetchJobs]);

  const handleCancel = async (jobId: string) => {
    setCancellingId(jobId);
    try {
      await cancelJob(jobId);
      toast.success("Job cancelled");
      await fetchJobs();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("Job is no longer active");
      } else {
        toast.error(err instanceof Error ? err.message : "Cancel failed");
      }
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Jobs</h1>
        <Link href="/" className="text-muted-foreground text-sm hover:text-foreground">
          ← Stories
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Active jobs</CardTitle>
          <p className="text-muted-foreground text-sm font-normal">
            Queued and running jobs. Cancel only when you intend to stop a job.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : jobs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No active jobs.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead className="w-[100px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((j) => (
                  <TableRow key={j.id}>
                    <TableCell className="font-medium">
                      {j.type === "generate" ? "Story" : "Voice"}
                    </TableCell>
                    <TableCell>
                      {j.storyId ? (
                        <Link
                          href={`/stories/${encodeURIComponent(j.storyId)}`}
                          className="text-primary hover:underline"
                        >
                          {j.storyId}
                        </Link>
                      ) : (
                        j.voiceId ?? "—"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={j.status === "running" ? "default" : "secondary"}>
                        {j.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground text-sm">
                      {j.message ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(j.id)}
                        disabled={cancellingId === j.id}
                      >
                        {cancellingId === j.id ? "Cancelling…" : "Cancel"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
