"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ApiError,
  renderStory,
  generateStory,
  listActiveJobs,
  getStoryFullAudioUrl,
  listStoryAudioFiles,
  getStoryAudioFileUrl,
  STORY_FULL_AUDIO_FILENAME,
} from "@/lib/api";
import { useJobWatcher } from "@/hooks/use-job-events";
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

type Props = {
  storyId: string;
};

export function StoryActions({ storyId }: Props) {
  const [resolved, setResolved] = useState<ResolvedLine[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [audioFiles, setAudioFiles] = useState<string[]>([]);
  const [hasFullAudio, setHasFullAudio] = useState(false);
  const { start: startPolling } = useJobWatcher();

  const refreshAudioFiles = useCallback(async () => {
    try {
      const files = await listStoryAudioFiles(storyId);
      setAudioFiles(files);
      setHasFullAudio(files.includes(STORY_FULL_AUDIO_FILENAME));
    } catch {
      // full.wav might exist even if the files list fails
    }
  }, [storyId]);

  const pollGenerationJob = useCallback(
    (jobId: string, { toasts }: { toasts: boolean }) => {
      startPolling(jobId, {
        onUpdate: (j) => {
          setJobStatus(j.status);
          setJobMessage(j.message ?? null);
        },
        onSucceeded: async () => {
          setHasFullAudio(true);
          await refreshAudioFiles();
          if (toasts) toast.success("Generation complete");
          setGenerating(false);
        },
        onFailed: (j) => {
          if (toasts) toast.error(j.message ?? "Generation failed");
          setGenerating(false);
        },
        onError: () => {
          if (toasts) toast.error("Failed to poll job");
          setGenerating(false);
        },
      });
    },
    [startPolling, refreshAudioFiles]
  );

  // On load, detect if this story already has generated audio
  useEffect(() => {
    void refreshAudioFiles();
  }, [refreshAudioFiles]);

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
        setJobStatus(existing.status);
        setJobMessage(existing.message ?? null);
        setGenerating(true);
        pollGenerationJob(existing.id, { toasts: false });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [storyId, pollGenerationJob]);

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
    setJobStatus(null);
    setJobMessage(null);
    try {
      const job = await generateStory(storyId, { concat: true });
      setJobStatus(job.status);
      setJobMessage(job.message ?? null);
      pollGenerationJob(job.id, { toasts: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error("A job is already running for this story. Manage or cancel it from Jobs.");
      } else {
        toast.error(err instanceof Error ? err.message : "Start generation failed");
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
