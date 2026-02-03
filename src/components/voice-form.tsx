"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Voice, VoiceConfig } from "@/lib/api-types";
import { createVoice, updateVoice, getJob } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const POLL_INTERVAL_MS = 2500;

function formatApiErrors(detail: unknown): string[] {
  if (!detail || typeof detail !== "object") return [];
  const d = detail as { errors?: Array<{ loc: string[]; msg: string }> };
  if (!Array.isArray(d.errors)) return [];
  return d.errors.map((e) => `${e.loc.join(".")}: ${e.msg}`);
}

function isJob(
  response: { id: string; status?: string }
): response is { id: string; status: string } {
  return "status" in response && typeof response.status === "string";
}

type Props = {
  initialVoice?: Voice | null;
  voiceId?: string | null;
};

export function VoiceForm({ initialVoice, voiceId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const [id, setId] = useState(initialVoice?.id ?? "");
  const [language, setLanguage] = useState(initialVoice?.language ?? "English");
  const [instruction, setInstruction] = useState(
    initialVoice?.instruction ?? ""
  );
  const [sampleText, setSampleText] = useState(
    initialVoice?.sample_text ?? ""
  );

  const isEdit = Boolean(voiceId && initialVoice);
  const isPolling = submitting && jobStatus !== null;

  const pollJob = (jobIdToPoll: string, successMessage: string) => {
    getJob(jobIdToPoll)
      .then((j) => {
        setJobStatus(j.status);
        setJobMessage(j.message ?? null);
        if (j.status === "succeeded") {
          toast.success(successMessage);
          setSubmitting(false);
          setJobStatus(null);
          setJobMessage(null);
          router.push("/voices");
          router.refresh();
          return;
        }
        if (j.status === "failed") {
          toast.error(j.message ?? "Job failed");
          setSubmitting(false);
          setJobStatus(null);
          setJobMessage(null);
          return;
        }
        setTimeout(() => pollJob(jobIdToPoll, successMessage), POLL_INTERVAL_MS);
      })
      .catch(() => {
        toast.error("Failed to poll job");
        setSubmitting(false);
        setJobStatus(null);
        setJobMessage(null);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      toast.error("ID is required");
      return;
    }
    if (!instruction.trim()) {
      toast.error("Instruction is required");
      return;
    }
    if (!sampleText.trim()) {
      toast.error("Sample text is required");
      return;
    }

    const config: VoiceConfig = {
      id: id.trim(),
      language: language.trim() || "English",
      instruction: instruction.trim(),
      sample_text: sampleText.trim(),
    };

    setSubmitting(true);
    setJobStatus(null);
    setJobMessage(null);

    try {
      if (isEdit && voiceId) {
        const response = await updateVoice(voiceId, config);
        if (isJob(response)) {
          setJobStatus(response.status);
          setJobMessage(response.message ?? null);
          setTimeout(
            () => pollJob(response.id, "Voice updated and regenerated"),
            POLL_INTERVAL_MS
          );
        } else {
          toast.success("Voice updated");
          router.push("/voices");
          router.refresh();
          setSubmitting(false);
        }
      } else {
        const job = await createVoice(config);
        setJobStatus(job.status);
        setJobMessage(job.message ?? null);
        setTimeout(
          () => pollJob(job.id, "Voice created"),
          POLL_INTERVAL_MS
        );
      }
    } catch (err: unknown) {
      const e = err as Error & { status?: number; detail?: unknown };
      if (e.status === 409) {
        toast.error(
          id === (initialVoice?.id ?? voiceId)
            ? "This voice is already being generated."
            : "A voice with this ID already exists or is being generated."
        );
      } else {
        const messages = formatApiErrors(e.detail);
        if (messages.length) messages.forEach((m) => toast.error(m));
        else toast.error(e.message ?? "Request failed");
      }
      setSubmitting(false);
      setJobStatus(null);
      setJobMessage(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="voice-id">ID</Label>
            <Input
              id="voice-id"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="e.g. narrator_male"
              required
              disabled={isEdit}
            />
            {isEdit && (
              <p className="text-muted-foreground text-xs">
                ID cannot be changed when editing.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice-language">Language</Label>
            <Input
              id="voice-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="English"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice-instruction">Instruction</Label>
            <Textarea
              id="voice-instruction"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Voice instruction/prompt for TTS"
              required
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="voice-sample">Sample text</Label>
            <Textarea
              id="voice-sample"
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              placeholder="Sample text used for voice generation"
              required
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {(jobStatus || jobMessage) && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {jobStatus && (
              <p>
                Status: <Badge>{jobStatus}</Badge>
              </p>
            )}
            {jobMessage && (
              <p className="text-muted-foreground text-sm">{jobMessage}</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting
            ? isPolling
              ? "Generating…"
              : "Saving…"
            : isEdit
              ? "Update voice"
              : "Create voice"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
