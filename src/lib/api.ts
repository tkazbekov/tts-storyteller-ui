/**
 * API client for the TTS Storyteller backend.
 * Uses NEXT_PUBLIC_API_URL or relative /api when Next rewrites are enabled.
 */

import type {
  GenerateRequest,
  Job,
  ResolvedLine,
  StorySummary,
  StoryTemplate,
  UploadResponse,
  Voice,
  VoiceCloneConfig,
  VoiceConfig,
} from "./api-types";

export type { ApiErrorDetail } from "./api-types";

/** Error thrown for non-2xx API responses. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Format a FastAPI error `detail` into human-readable messages.
 * Handles both FastAPI's native validation shape (detail is an array of
 * {loc, msg}) and this backend's custom shape (detail is {errors: [...]}).
 */
export function formatApiErrors(detail: unknown): string[] {
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

function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return process.env.NEXT_PUBLIC_API_URL ?? "";
  }
  // Server components may reach the API on a different URL than the browser
  // (e.g. Docker/LAN); API_URL is read at runtime, NEXT_PUBLIC_* at build time.
  return process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
}

function getBase(): string {
  const base = getApiBaseUrl();
  return base || "/api";
}

/** Exported for tests. */
export function buildUrl(path: string): string {
  const base = getBase();
  return path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function toApiError(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}));
  const detail = (body as { detail?: unknown })?.detail;
  const messages = formatApiErrors(detail);
  const message =
    typeof detail === "string"
      ? detail
      : messages.length > 0
        ? messages.join("; ")
        : detail && typeof detail === "object"
          ? JSON.stringify(detail)
          : res.statusText;
  return new ApiError(message, res.status, detail);
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(buildUrl(path), { ...options, headers });
  if (!res.ok) {
    throw await toApiError(res);
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

async function requestUpload<T>(path: string, formData: FormData): Promise<T> {
  const res = await fetch(buildUrl(path), {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw await toApiError(res);
  }
  return res.json() as Promise<T>;
}

// --- Stories ---

export async function listStories(): Promise<StorySummary[]> {
  return request<StorySummary[]>("/stories");
}

export async function getStory(identifier: string): Promise<StoryTemplate> {
  return request<StoryTemplate>(`/stories/${encodeURIComponent(identifier)}`);
}

export async function createStory(story: Omit<StoryTemplate, "id" | "slug"> & { id?: string | null; slug?: string | null }): Promise<StoryTemplate> {
  return request<StoryTemplate>("/stories", {
    method: "POST",
    body: JSON.stringify({ ...story, schemaVersion: 1 }),
  });
}

export async function updateStory(storyId: string, story: StoryTemplate): Promise<StoryTemplate> {
  return request<StoryTemplate>(`/stories/${encodeURIComponent(storyId)}`, {
    method: "PUT",
    body: JSON.stringify(story),
  });
}

export async function renderStory(storyId: string): Promise<ResolvedLine[]> {
  return request<ResolvedLine[]>(`/stories/${encodeURIComponent(storyId)}/render`, {
    method: "POST",
  });
}

export async function generateStory(
  storyId: string,
  body?: GenerateRequest,
  options?: { cancelExisting?: boolean }
): Promise<Job> {
  const qs = options?.cancelExisting ? "?cancel_existing=true" : "";
  return request<Job>(`/stories/${encodeURIComponent(storyId)}/generate${qs}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Jobs ---

export async function listActiveJobs(): Promise<Job[]> {
  return request<Job[]>("/jobs");
}

export async function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
  });
}

// --- Audio ---

/**
 * Name of the concatenated full-story WAV in the story's files list.
 * Contract with the backend: lib/paths.py get_story_full_audio_path().
 */
export const STORY_FULL_AUDIO_FILENAME = "story_full.wav";

export function getStoryFullAudioUrl(storyId: string): string {
  return `${getBase().replace(/\/$/, "")}/audio/stories/${encodeURIComponent(storyId)}/full.wav`;
}

export async function listStoryAudioFiles(storyId: string): Promise<string[]> {
  return request<string[]>(`/audio/stories/${encodeURIComponent(storyId)}/files`);
}

export function getStoryAudioFileUrl(storyId: string, filename: string): string {
  return `${getBase().replace(/\/$/, "")}/audio/stories/${encodeURIComponent(storyId)}/files/${encodeURIComponent(filename)}`;
}

export function getVoiceSampleAudioUrl(voiceId: string): string {
  return `${getBase().replace(/\/$/, "")}/audio/voices/${encodeURIComponent(voiceId)}.wav`;
}

export async function uploadReferenceAudio(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  return requestUpload<UploadResponse>("/audio/upload", formData);
}

// --- Voices ---

export async function listVoices(): Promise<Voice[]> {
  return request<Voice[]>("/voices");
}

export async function getVoice(voiceId: string): Promise<Voice> {
  return request<Voice>(`/voices/${encodeURIComponent(voiceId)}`);
}

export async function createVoice(config: VoiceConfig): Promise<Job> {
  return request<Job>("/voices", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function cloneVoice(config: VoiceCloneConfig): Promise<Job> {
  return request<Job>("/voices/clone", {
    method: "POST",
    body: JSON.stringify(config),
  });
}

export async function updateVoice(
  voiceId: string,
  config: VoiceConfig
): Promise<Job | Voice> {
  return request<Job | Voice>(`/voices/${encodeURIComponent(voiceId)}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
}

export async function deleteVoice(voiceId: string): Promise<void> {
  return request<void>(`/voices/${encodeURIComponent(voiceId)}`, {
    method: "DELETE",
  });
}
