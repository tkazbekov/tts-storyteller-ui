"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { Voice } from "@/lib/api-types";
import {
  ApiError,
  cloneVoice,
  createVoice,
  updateVoice,
  uploadReferenceAudio,
} from "@/lib/api";
import {
  makeVoiceFormSchema,
  toVoiceCloneConfig,
  toVoiceConfig,
  voiceFieldPath,
  type VoiceFormValues,
} from "@/lib/forms/voice-schema";
import { applyServerErrors } from "@/lib/forms/server-errors";
import { useJobWatcher } from "@/hooks/use-job-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, fieldAria } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Props = {
  initialVoice?: Voice | null;
  voiceId?: string | null;
};

function isJob(
  response: { id: string; status?: string }
): response is { id: string; status: string } {
  return "status" in response && typeof response.status === "string";
}

export function VoiceForm({ initialVoice, voiceId }: Props) {
  const router = useRouter();
  // Manual submit lifecycle state (NOT RHF's isSubmitting): generation
  // continues via job watching long after handleSubmit resolves.
  const [submitting, setSubmitting] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [jobMessage, setJobMessage] = useState<string | null>(null);
  const { start: startPolling } = useJobWatcher();

  const isEdit = Boolean(voiceId && initialVoice);
  const isCloneEdit = isEdit && Boolean(initialVoice?.refAudioPath);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    watch,
    // Compiler-safety: destructure formState here, in the component that owns
    // useForm; never pass the proxy object down.
    formState: { errors },
  } = useForm<VoiceFormValues>({
    resolver: zodResolver(makeVoiceFormSchema({ isEdit })),
    defaultValues: {
      mode: initialVoice?.refAudioPath ? "clone" : "design",
      id: initialVoice?.id ?? "",
      language: initialVoice?.language ?? "English",
      instruction: initialVoice?.instruction ?? "",
      backend: initialVoice?.backend ?? "qwen",
      sampleText: initialVoice?.sample_text ?? "",
      referenceAudio: null,
      referenceText: "",
    } as VoiceFormValues,
  });

  const mode = watch("mode");
  const isPolling = submitting && jobStatus !== null;

  const resetJobState = () => {
    setSubmitting(false);
    setJobStatus(null);
    setJobMessage(null);
  };

  const pollJob = (jobIdToPoll: string, successMessage: string) => {
    startPolling(jobIdToPoll, {
      onUpdate: (j) => {
        setJobStatus(j.status);
        setJobMessage(j.message ?? null);
      },
      onSucceeded: () => {
        toast.success(successMessage);
        resetJobState();
        router.push("/voices");
        router.refresh();
      },
      onFailed: (j) => {
        toast.error(j.message ?? "Job failed");
        resetJobState();
      },
      onError: () => {
        toast.error("Failed to poll job");
        resetJobState();
      },
    });
  };

  const onSubmit = handleSubmit(async (values) => {
    setSubmitting(true);
    setJobStatus(null);
    setJobMessage(null);

    try {
      if (values.mode === "clone") {
        if (!values.referenceAudio) throw new Error("Reference audio is required");
        setJobMessage("Uploading reference audio…");
        const upload = await uploadReferenceAudio(values.referenceAudio);
        setJobMessage("Queued for voice cloning…");
        const job = await cloneVoice(toVoiceCloneConfig(values, upload.file_path));
        setJobStatus(job.status);
        setJobMessage(job.message ?? null);
        pollJob(job.id, "Voice clone created");
        return;
      }

      const config = toVoiceConfig(values);

      if (isEdit && voiceId) {
        const response = await updateVoice(voiceId, config);
        if (isJob(response)) {
          setJobStatus(response.status);
          setJobMessage(response.message ?? null);
          pollJob(response.id, "Voice updated and regenerated");
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
        pollJob(job.id, "Voice created");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.error(
          values.id === (initialVoice?.id ?? voiceId)
            ? "This voice is already being generated."
            : "A voice with this ID already exists or is being generated."
        );
      } else if (err instanceof ApiError) {
        const unmapped = applyServerErrors(err, setError, voiceFieldPath);
        if (unmapped.length) {
          setError("root.serverError", { message: unmapped.join("; ") });
          unmapped.forEach((m) => toast.error(m));
        }
      } else {
        toast.error(err instanceof Error ? err.message : "Request failed");
      }
      resetJobState();
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {errors.root?.serverError && (
            <p role="alert" className="text-destructive text-sm">
              {errors.root.serverError.message}
            </p>
          )}

          {!isEdit && (
            <Field
              label="Creation mode"
              htmlFor="voice-mode"
              description="Voice design uses POST /voices and is Qwen-only. Cloning uploads reference audio, then calls POST /voices/clone for Qwen or VibeVoice."
            >
              <Controller
                name="mode"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      if (v === "design") setValue("backend", "qwen");
                    }}
                  >
                    <SelectTrigger id="voice-mode" className="w-full" ref={field.ref}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="design">Qwen voice design from text</SelectItem>
                      <SelectItem value="clone">Clone from reference audio</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          )}

          <Field
            label="ID"
            htmlFor="voice-id"
            error={errors.id?.message}
            description={isEdit ? "ID cannot be changed when editing." : undefined}
          >
            <Input
              {...register("id")}
              {...fieldAria("voice-id", errors.id?.message)}
              placeholder="e.g. narrator_male"
              disabled={isEdit}
            />
          </Field>

          <Field label="Backend" htmlFor="voice-backend" error={errors.backend?.message}>
            <Controller
              name="backend"
              control={control}
              render={({ field }) => (
                <Select
                  value={mode === "design" ? "qwen" : field.value}
                  onValueChange={field.onChange}
                  disabled={mode === "design" || isEdit}
                >
                  <SelectTrigger id="voice-backend" className="w-full" ref={field.ref}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="qwen">Qwen TTS</SelectItem>
                    <SelectItem value="vibevoice">VibeVoice</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          <Field label="Language" htmlFor="voice-language" error={errors.language?.message}>
            <Input
              {...register("language")}
              {...fieldAria("voice-language", errors.language?.message)}
              placeholder="English"
            />
          </Field>

          <Field
            label="Instruction"
            htmlFor="voice-instruction"
            error={errors.instruction?.message}
          >
            <Textarea
              {...register("instruction")}
              {...fieldAria("voice-instruction", errors.instruction?.message)}
              placeholder={
                mode === "clone"
                  ? "Voice description/notes for this reference speaker"
                  : "Voice instruction/prompt for Qwen voice design"
              }
              rows={4}
              disabled={isCloneEdit}
            />
          </Field>

          {mode === "design" ? (
            <Field
              label="Sample text"
              htmlFor="voice-sample"
              error={"sampleText" in errors ? errors.sampleText?.message : undefined}
            >
              <Textarea
                {...register("sampleText")}
                {...fieldAria(
                  "voice-sample",
                  "sampleText" in errors ? errors.sampleText?.message : undefined
                )}
                placeholder="Sample text used for voice generation"
                rows={3}
              />
            </Field>
          ) : (
            <div className="space-y-4">
              {isCloneEdit ? (
                <p className="text-muted-foreground text-sm">
                  This voice was created from reference audio. To change the reference, delete and
                  recreate the cloned voice.
                </p>
              ) : (
                <Field
                  label="Reference audio"
                  htmlFor="voice-reference-audio"
                  error={"referenceAudio" in errors ? errors.referenceAudio?.message : undefined}
                >
                  <Controller
                    name="referenceAudio"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...fieldAria(
                          "voice-reference-audio",
                          "referenceAudio" in errors ? errors.referenceAudio?.message : undefined
                        )}
                        type="file"
                        accept="audio/wav,audio/x-wav,audio/*"
                        ref={field.ref}
                        onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
                      />
                    )}
                  />
                </Field>
              )}
              <Field
                label="Reference transcript"
                htmlFor="voice-reference-text"
                error={"referenceText" in errors ? errors.referenceText?.message : undefined}
              >
                <Textarea
                  {...register("referenceText")}
                  {...fieldAria(
                    "voice-reference-text",
                    "referenceText" in errors ? errors.referenceText?.message : undefined
                  )}
                  placeholder="Optional transcript of the reference clip"
                  rows={3}
                  disabled={isCloneEdit}
                />
              </Field>
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
