"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { TtsBackend, Voice, VoiceConfig } from "@/lib/api-types";
import { cloneVoice, createVoice, getJob, updateVoice, uploadReferenceAudio } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const POLL_INTERVAL_MS = 2500;

type CreationMode = "design" | "clone";

type Props = {
  initialVoice?: Voice | null;
  voiceId?: string | null;
};

function formatApiErrors(detail: unknown): string[] {
  const formatOne = (e: { loc?: unknown; msg?: unknown }) => {
    const loc = Array.isArray(e.loc) ? e.loc.join(".") : "request";
    const msg = typeof e.msg === "string" ? e.msg : "Invalid value";
    return `${loc}: ${msg}`;
  };

  if (Array.isArray(detail)) {
    return detail
      .filter((e): e is { loc?: unknown; msg?: unknown } => Boolean(e) && typeof e === "object")
      .map(formatOne);
  }

  if (!detail || typeof detail !== "object") return [];
  const d = detail as { errors?: Array<{ loc?: unknown; msg?: unknown }> };
  if (!Array.isArray(d.errors)) return [];
  return d.errors.map(formatOne);
}

function isJob(
  response: { id: string; status?: string }
): response is { id: string; status: string } {
  return "status" in response && typeof response.status === "string";
}

export function VoiceForm({ initialVoice, voiceId }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);

  const [id, setId] = useState(initialVoice?.id ?? "");
  const [language, setLanguage] = useState(initialVoice?.language ?? "English");
  const [instruction, setInstruction] = useState(initialVoice?.instruction ?? "");
  const [sampleText, setSampleText] = useState(initialVoice?.sample_text ?? "");
  const [mode, setMode] = useState<CreationMode>(initialVoice?.refAudioPath ? "clone" : "design");
  const [backend, setBackend] = useState<TtsBackend>(initialVoice?.backend ?? "qwen");
  const [referenceAudio, setReferenceAudio] = useState<File | null>(null);
  const [referenceText, setReferenceText] = useState("");

  const isEdit = Boolean(voiceId && initialVoice);
  const isCloneEdit = isEdit && mode === "clone";
  const isPolling = submitting && jobStatus !== null;

  const resetJobState = () => {
    setSubmitting(false);
    setJobStatus(null);
    setJobMessage(null);
  };

  const pollJob = (jobIdToPoll: string, successMessage: string) => {
    getJob(jobIdToPoll)
      .then((j) => {
        setJobStatus(j.status);
        setJobMessage(j.message ?? null);
        if (j.status === "succeeded") {
          toast.success(successMessage);
          resetJobState();
          router.push("/voices");
          router.refresh();
          return;
        }
        if (j.status === "failed") {
          toast.error(j.message ?? "Job failed");
          resetJobState();
          return;
        }
        setTimeout(() => pollJob(jobIdToPoll, successMessage), POLL_INTERVAL_MS);
      })
      .catch(() => {
        toast.error("Failed to poll job");
        resetJobState();
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
    if (mode === "design" && !sampleText.trim()) {
      toast.error("Sample text is required for Qwen voice design");
      return;
    }
    if (!isEdit && mode === "clone" && !referenceAudio) {
      toast.error("Reference audio is required for voice cloning");
      return;
    }

    setSubmitting(true);
    setJobStatus(null);
    setJobMessage(null);

    try {
      if (mode === "clone") {
        if (!referenceAudio) throw new Error("Reference audio is required");
        setJobMessage("Uploading reference audio…");
        const upload = await uploadReferenceAudio(referenceAudio);
        setJobMessage("Queued for voice cloning…");
        const job = await cloneVoice({
          id: id.trim(),
          language: language.trim() || "English",
          instruction: instruction.trim(),
          ref_audio_url: upload.file_path,
          ref_text: referenceText.trim() || null,
          backend,
        });
        setJobStatus(job.status);
        setJobMessage(job.message ?? null);
        setTimeout(() => pollJob(job.id, "Voice clone created"), POLL_INTERVAL_MS);
        return;
      }

      const config: VoiceConfig = {
        id: id.trim(),
        language: language.trim() || "English",
        instruction: instruction.trim(),
        sample_text: sampleText.trim(),
        backend: "qwen",
      };

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
          resetJobState();
        }
      } else {
        const job = await createVoice(config);
        setJobStatus(job.status);
        setJobMessage(job.message ?? null);
        setTimeout(() => pollJob(job.id, "Voice created"), POLL_INTERVAL_MS);
      }
    } catch (err: unknown) {
      const error = err as Error & { status?: number; detail?: unknown };
      if (error.status === 409) {
        toast.error(
          id === (initialVoice?.id ?? voiceId)
            ? "This voice is already being generated."
            : "A voice with this ID already exists or is being generated."
        );
      } else {
        const messages = formatApiErrors(error.detail);
        if (messages.length) messages.forEach((m) => toast.error(m));
        else toast.error(error.message ?? "Request failed");
      }
      resetJobState();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="voice-mode">Creation mode</Label>
              <select
                id="voice-mode"
                value={mode}
                onChange={(e) => {
                  const next = e.target.value as CreationMode;
                  setMode(next);
                  if (next === "design") setBackend("qwen");
                }}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="design">Qwen voice design from text</option>
                <option value="clone">Clone from reference audio</option>
              </select>
              <p className="text-muted-foreground text-xs">
                Voice design uses POST /voices and is Qwen-only. Cloning uploads reference audio, then calls POST /voices/clone for Qwen or VibeVoice.
              </p>
            </div>
          )}

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
            {isEdit && <p className="text-muted-foreground text-xs">ID cannot be changed when editing.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="voice-backend">Backend</Label>
            <select
              id="voice-backend"
              value={mode === "design" ? "qwen" : backend}
              onChange={(e) => setBackend(e.target.value as TtsBackend)}
              disabled={mode === "design" || isEdit}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="qwen">Qwen TTS</option>
              <option value="vibevoice">VibeVoice</option>
            </select>
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
              placeholder={mode === "clone" ? "Voice description/notes for this reference speaker" : "Voice instruction/prompt for Qwen voice design"}
              required
              rows={4}
              disabled={isCloneEdit}
            />
          </div>

          {mode === "design" ? (
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
          ) : (
            <div className="space-y-4">
              {isCloneEdit ? (
                <p className="text-muted-foreground text-sm">
                  This voice was created from reference audio. To change the reference, delete and recreate the cloned voice.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="voice-reference-audio">Reference audio</Label>
                  <Input
                    id="voice-reference-audio"
                    type="file"
                    accept="audio/wav,audio/x-wav,audio/*"
                    onChange={(e) => setReferenceAudio(e.target.files?.[0] ?? null)}
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="voice-reference-text">Reference transcript</Label>
                <Textarea
                  id="voice-reference-text"
                  value={referenceText}
                  onChange={(e) => setReferenceText(e.target.value)}
                  placeholder="Optional transcript of the reference clip"
                  rows={3}
                  disabled={isCloneEdit}
                />
              </div>
            </div>
          )}
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
            {jobMessage && <p className="text-muted-foreground text-sm">{jobMessage}</p>}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting || isCloneEdit}>
          {submitting
            ? isPolling
              ? "Generating…"
              : "Saving…"
            : isEdit
              ? "Update voice"
              : mode === "clone"
                ? "Create clone"
                : "Create voice"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
