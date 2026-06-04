/** TypeScript types mirroring the TTS Storyteller API (lib/models.py). */

export type TtsBackend = "qwen" | "vibevoice";

export interface Role {
  roleId: number;
  name: string;
  notes: string | null;
}

export interface StoryLine {
  id: number;
  roleId: number;
  line: string;
  extra: string | null;
  actorId: string | null;
}

export interface StoryTemplate {
  id: string | null;
  slug: string | null;
  schemaVersion: 1;
  title: string;
  language: string;
  defaultVoiceId: string;
  roles: Role[];
  casting: Record<string, string> | null;
  lines: StoryLine[];
}

export interface StorySummary {
  id: string | null;
  slug: string;
  title: string;
}

export interface ResolvedLine {
  id: number;
  roleId: number;
  voiceId: string;
  line: string;
  extra: string | null;
}

export interface Voice {
  id: string;
  language: string;
  instruction: string;
  sample_text: string | null;
  backend: TtsBackend;
  promptPath: string | null;
  refAudioPath: string | null;
}

export interface VoiceConfig {
  id: string;
  language: string;
  instruction: string;
  sample_text: string;
  backend: "qwen";
}

export interface VoiceCloneConfig {
  id: string;
  language: string;
  instruction: string;
  ref_audio_url: string;
  ref_text?: string | null;
  backend: TtsBackend;
}

export interface VoicePool {
  name: string;
  voiceIds: string[];
}

export interface GenerateRequest {
  concat?: boolean;
  concatOut?: string | null;
}

export interface Job {
  id: string;
  type: string;
  status: "queued" | "running" | "succeeded" | "failed";
  storyId: string | null;
  voiceId: string | null;
  message: string | null;
  outputPath: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  requestParams: Record<string, unknown> | null;
}

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
