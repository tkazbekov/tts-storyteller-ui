/**
 * Voice form schema and form↔API mappers. Pure module — no React imports.
 * Form-internal shape differs from the API shape; the mappers are the boundary.
 */

import { z } from "zod";
import type { VoiceCloneConfig, VoiceConfig } from "@/lib/api-types";

/** Mirrors the backend id pattern ^[a-zA-Z0-9_-]{1,100}$ (422 on violation). */
export const VOICE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,100}$/;

// SSR-safe File check: never touch the File global at module scope.
function isFile(v: unknown): v is File {
  return typeof File !== "undefined" && v instanceof File;
}

const voiceBase = z.object({
  id: z
    .string()
    .trim()
    .min(1, "ID is required")
    .regex(VOICE_ID_PATTERN, "Use only letters, digits, underscores, and dashes (max 100 chars)"),
  language: z.string(),
  instruction: z.string().trim().min(1, "Instruction is required"),
  backend: z.enum(["qwen", "vibevoice"]),
});

/** `isEdit` decides whether referenceAudio is required (never on edit). */
export function makeVoiceFormSchema(opts: { isEdit: boolean }) {
  return z
    .discriminatedUnion("mode", [
      voiceBase.extend({
        mode: z.literal("design"),
        sampleText: z.string().trim().min(1, "Sample text is required for Qwen voice design"),
      }),
      voiceBase.extend({
        mode: z.literal("clone"),
        referenceAudio: z.custom<File | null>((v) => v === null || isFile(v)),
        referenceText: z.string(),
      }),
    ])
    .superRefine((data, ctx) => {
      if (data.mode === "clone" && !opts.isEdit && !isFile(data.referenceAudio)) {
        ctx.addIssue({
          code: "custom",
          path: ["referenceAudio"],
          message: "Reference audio is required for voice cloning",
        });
      }
    });
}

export type VoiceFormValues = z.infer<ReturnType<typeof makeVoiceFormSchema>>;

export function toVoiceConfig(v: Extract<VoiceFormValues, { mode: "design" }>): VoiceConfig {
  return {
    id: v.id.trim(),
    language: v.language.trim() || "English",
    instruction: v.instruction.trim(),
    sample_text: v.sampleText.trim(),
    backend: "qwen",
  };
}

export function toVoiceCloneConfig(
  v: Extract<VoiceFormValues, { mode: "clone" }>,
  refAudioUrl: string
): VoiceCloneConfig {
  return {
    id: v.id.trim(),
    language: v.language.trim() || "English",
    instruction: v.instruction.trim(),
    ref_audio_url: refAudioUrl,
    ref_text: v.referenceText.trim() || null,
    backend: v.backend,
  };
}

/** Maps API error paths (from FastAPI `loc`) to voice-form field paths. */
export function voiceFieldPath(apiPath: string): string | null {
  const map: Record<string, string> = {
    id: "id",
    language: "language",
    instruction: "instruction",
    backend: "backend",
    sample_text: "sampleText",
    ref_text: "referenceText",
    ref_audio_url: "referenceAudio",
  };
  return map[apiPath] ?? null;
}
