/**
 * API client for qwen3-tts backend.
 * Uses NEXT_PUBLIC_API_URL (default http://localhost:8000) or relative /api if rewrites are used.
 */

import type {
  GenerateRequest,
  Job,
  ResolvedLine,
  StorySummary,
  StoryTemplate,
  Voice,
} from "./api-types";

export type { ApiErrorDetail } from "./api-types";

function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== "undefined" ? "" : "http://localhost:8000");
}

function getBase(): string {
  const base = getApiBaseUrl();
  return base || "/api";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const base = getBase();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body?.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail && typeof detail === "object"
          ? JSON.stringify(detail)
          : res.statusText;
    const err = new Error(message) as Error & { status: number; detail: unknown };
    err.status = res.status;
    err.detail = detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
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
  body?: GenerateRequest
): Promise<Job> {
  return request<Job>(`/stories/${encodeURIComponent(storyId)}/generate`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

// --- Jobs ---

export async function getJob(jobId: string): Promise<Job> {
  return request<Job>(`/jobs/${encodeURIComponent(jobId)}`);
}

// --- Audio ---

export function getStoryFullAudioUrl(storyId: string): string {
  const base = getBase();
  return `${base.replace(/\/$/, "")}/audio/stories/${encodeURIComponent(storyId)}/full.wav`;
}

export async function listStoryAudioFiles(storyId: string): Promise<string[]> {
  return request<string[]>(`/audio/stories/${encodeURIComponent(storyId)}/files`);
}

export function getStoryAudioFileUrl(storyId: string, filename: string): string {
  const base = getBase();
  return `${base.replace(/\/$/, "")}/audio/stories/${encodeURIComponent(storyId)}/files/${encodeURIComponent(filename)}`;
}

// --- Voices ---

export async function listVoices(pool?: string): Promise<Voice[]> {
  const qs = pool ? `?pool=${encodeURIComponent(pool)}` : "";
  return request<Voice[]>(`/voices${qs}`);
}

export async function getVoice(voiceId: string): Promise<Voice> {
  return request<Voice>(`/voices/${encodeURIComponent(voiceId)}`);
}
