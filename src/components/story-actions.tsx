"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  renderStory,
  generateStory,
  getJob,
  listActiveJobs,
  getStoryFullAudioUrl,
  listStoryAudioFiles,
  getStoryAudioFileUrl,
} from "@/lib/api";
import { AudioPlayerWithDownload } from "@/components/audio-player-with-download";
import type { ResolvedLine } from "@/lib/api-types";
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

const POLL_INTERVAL_MS = 2500;

type Props = {
  storyId: string;
};

export function StoryActions({ storyId }: Props) {
  const [resolved, setResolved] = useState<ResolvedLine[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [hasFullAudio, setHasFullAudio] = useState(false);

  // On load, detect if this story already has generated audio
  useEffect(() => {
    let cancelled = false;
    listStoryAudioFiles(storyId)
      .then((files) => {
        if (cancelled) return;
        setAudioFiles(files);
        setHasFullAudio(files.includes("story_full.wav"));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  // If there is already an active job for this story, show it and poll
  useEffect(() => {
    let cancelled = false;
    listActiveJobs()
      .then((list) => {
        if (cancelled) return;
        const existing = list.find(
          (j) => j.type === "generate" && j.storyId === storyId && (j.status === "queued" || j.status === "running")
        );
        if (!existing) return;
        setJobId(existing.id);
        setJobStatus(existing.status);
        setJobMessage(existing.message ?? null);
        setGenerating(true);
        const poll = async (jobIdToPoll: string) => {
          if (cancelled) return;
          try {
            const j = await getJob(jobIdToPoll);
            if (cancelled) return;
            setJobStatus(j.status);
            setJobMessage(j.message ?? null);
            if (j.status === "succeeded") {
              setHasFullAudio(true);
              try {
                const files = await listStoryAudioFiles(storyId);
                setAudioFiles(files);
              } catch {
                // ignore
              }
              setGenerating(false);
              return;
            }
            if (j.status === "failed") {
              setGenerating(false);
              return;
            }
            setTimeout(() => poll(jobIdToPoll), POLL_INTERVAL_MS);
          } catch {
            if (!cancelled) setGenerating(false);
          }
        };
        setTimeout(() => poll(existing.id), POLL_INTERVAL_MS);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  const handlePreview = async () => {
    setLoadingPreview(true);
    setResolved(null);
    try {
      const data = await renderStory(storyId);
      setResolved(data);
      toast.success("Voice preview updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setJobId(null);
    setJobStatus(null);
    setJobMessage(null);
    try {
      const job = await generateStory(storyId, { concat: true });
      setJobId(job.id);
      setJobStatus(job.status);
      setJobMessage(job.message ?? null);

      const poll = async (jobIdToPoll: string) => {
        try {
          const j = await getJob(jobIdToPoll);
          setJobStatus(j.status);
          setJobMessage(j.message ?? null);
          if (j.status === "succeeded") {
            setHasFullAudio(true);
            try {
              const files = await listStoryAudioFiles(storyId);
              setAudioFiles(files);
            } catch {
              // full.wav might exist even if files list fails
            }
            toast.success("Generation complete");
            setGenerating(false);
            return;
          }
          if (j.status === "failed") {
            toast.error(j.message ?? "Generation failed");
            setGenerating(false);
            return;
          }
          setTimeout(() => poll(jobIdToPoll), POLL_INTERVAL_MS);
        } catch {
          toast.error("Failed to poll job");
          setGenerating(false);
        }
      };
      setTimeout(() => poll(job.id), POLL_INTERVAL_MS);
    } catch (err) {
      const e = err as Error & { status?: number };
      if (e.status === 409) {
        toast.error("A job is already running for this story. Manage or cancel it from Jobs.");
      } else {
        toast.error(e.message ?? "Start generation failed");
      }
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Voice preview</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? "Loading…" : "Preview voices"}
          </Button>
        </CardHeader>
        {resolved && resolved.length > 0 && (
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Line</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Voice</TableHead>
                  <TableHead>Text</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resolved.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.id}</TableCell>
                    <TableCell>{r.roleId}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.voiceId}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{r.line}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        )}
        {resolved && resolved.length === 0 && (
          <CardContent className="text-muted-foreground text-sm">
            No lines to preview.
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Generate audio</CardTitle>
          <Button
            onClick={handleGenerate}
            disabled={generating}
          >
            {generating ? (jobStatus ?? "Starting…") : "Generate"}
          </Button>
        </CardHeader>
        {(jobStatus || jobMessage) && (
          <CardContent className="space-y-2">
            {jobStatus && (
              <p className="flex items-center gap-2">
                <span>Status: <Badge>{jobStatus}</Badge></span>
                <Link
                  href="/jobs"
                  className="text-muted-foreground text-sm hover:text-foreground underline"
                >
                  Manage in Jobs
                </Link>
              </p>
            )}
            {jobMessage && <p className="text-muted-foreground text-sm">{jobMessage}</p>}
          </CardContent>
        )}
      </Card>

      {(hasFullAudio || audioFiles.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Play audio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasFullAudio && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Full story</p>
                <AudioPlayerWithDownload
                  src={getStoryFullAudioUrl(storyId)}
                  downloadFilename={`${storyId}_full.wav`}
                  downloadLabel="Download full"
                />
              </div>
            )}
            {audioFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">By file</p>
                <ul className="space-y-2">
                  {audioFiles.map((filename) => (
                    <li key={filename} className="flex flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-sm w-40 shrink-0 truncate">
                        {filename}
                      </span>
                      <AudioPlayerWithDownload
                        src={getStoryAudioFileUrl(storyId, filename)}
                        downloadFilename={filename}
                        downloadLabel="Download"
                        className="flex-1 min-w-0"
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
