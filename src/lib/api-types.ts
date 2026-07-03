/**
 * Types for the TTS Storyteller API.
 *
 * `api-schema.d.ts` is GENERATED from the backend's OpenAPI spec — run
 * `npm run codegen` after backend model changes. This file only re-exports
 * (and where noted, tightens) the generated shapes; don't hand-write API
 * types here.
 */

import type { components } from "./api-schema";

type Schemas = components["schemas"];

/** Backends supported by the API (the generated schema types this as plain string). */
export type TtsBackend = "qwen" | "vibevoice";

/** Job lifecycle states (see backend services/jobs.py; schema types this as plain string). */
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type Role = Schemas["Role"];
export type StoryLine = Schemas["StoryLine"];
export type StoryTemplate = Schemas["StoryTemplate"];
export type StorySummary = Schemas["StorySummary"];
export type ResolvedLine = Schemas["ResolvedLine"];
export type GenerateRequest = Partial<Schemas["GenerateRequest"]>;

export type Job = Omit<Schemas["Job"], "status"> & { status: JobStatus };

export type Voice = Omit<Schemas["Voice"], "backend"> & { backend: TtsBackend };
export type VoiceConfig = Omit<Schemas["VoiceConfig"], "backend"> & { backend: "qwen" };
export type VoiceCloneConfig = Omit<Schemas["VoiceCloneConfig"], "backend"> & {
  backend: TtsBackend;
};

/** POST /audio/upload returns a plain string map; field names documented here. */
export interface UploadResponse {
  file_path: string;
  filename: string;
  original_filename: string;
}

/** API 4xx/5xx error detail (FastAPI sends { detail: string | { errors: ... } }). */
export interface ApiErrorDetail {
  errors?: Array<{ loc: string[]; msg: string }>;
  [key: string]: unknown;
}
