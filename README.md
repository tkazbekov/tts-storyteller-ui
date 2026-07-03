# TTS Storyteller UI

Browser UI for [TTS Storyteller](https://github.com/tkazbekov/tts-storyteller), a local multi-backend text-to-speech API for generating multi-voice stories.

This is a companion Next.js app for managing stories, voices, background jobs, and generated audio. It is not an official Qwen or VibeVoice project.

## Features

- Browse, create, and edit story templates.
- Assign voices through story defaults, role casting, and per-line actor overrides.
- Preview resolved story-to-voice assignments before generation.
- Start story audio generation and monitor queued/running jobs.
- Play and download generated full-story and per-file audio.
- Browse, create, edit, and delete voices.
- Create Qwen voice-design voices from text prompts.
- Create cloned voices from uploaded reference audio for Qwen or VibeVoice.

Status: usable local companion UI, still early. Qwen is the main tested backend path. VibeVoice clone support follows the current TTS Storyteller API but should be treated as experimental until verified end-to-end on your GPU.

## Requirements

- Node.js 24+ recommended
- npm 11+
- A running TTS Storyteller API, usually at `http://localhost:8000`

Start the backend first:

```bash
git clone https://github.com/tkazbekov/tts-storyteller.git
cd tts-storyteller
./scripts/start.sh --backend qwen
```

For VibeVoice dependencies/models:

```bash
./scripts/start.sh --backend vibevoice
# or
./scripts/start.sh --backend all
```

The backend exposes Swagger docs at:

```text
http://localhost:8000/docs
```

## Configuration

Copy the example environment file if you want the UI to call a non-default API URL:

```bash
cp .env.example .env.local
```

Environment variables:

- `NEXT_PUBLIC_API_URL` - base URL of the TTS Storyteller API. If unset in the browser, the app uses the local `/api` rewrite, which proxies to `http://localhost:8000` during development.

Example:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Development

Install dependencies and start the UI:

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

Run quality checks:

```bash
npm run lint
npm run build
npm audit --omit=dev --audit-level=high
```

### API type generation

`src/lib/api-schema.d.ts` is generated from the backend's OpenAPI spec, and
`src/lib/api-types.ts` re-exports named types from it. After backend model
changes, regenerate:

```bash
npm run codegen
```

This reads `../tts-storyteller/docs/openapi.json` (assumes the backend repo is
checked out next to this one). To generate from a running backend instead:

```bash
npx openapi-typescript http://localhost:8000/openapi.json -o src/lib/api-schema.d.ts
```

### Live job updates

Job status streams over Server-Sent Events from `GET /jobs/events` (one shared
connection per tab). By default this flows through the `/api` rewrite; the
backend sends `Cache-Control: no-transform` so proxies don't buffer the
stream. With `NEXT_PUBLIC_API_URL` set, the `EventSource` connects to the
backend directly (its CORS already allows it). If the stream fails
persistently — including against older backends without the endpoint — the UI
silently degrades to the previous polling behavior for the rest of the page
session.

## Typical workflow

1. Start the backend with `./scripts/start.sh` from the `tts-storyteller` repo.
2. Start this UI with `npm run dev`.
3. Create or import voices:
   - **Voice design** uses `POST /voices` and is Qwen-only.
   - **Voice clone** uploads reference audio with `POST /audio/upload`, then creates a voice with `POST /voices/clone`. It supports Qwen and VibeVoice.
4. Create a story and assign voices.
5. Use **Preview voices** to verify resolution.
6. Use **Generate** to enqueue audio generation.
7. Monitor progress from **Jobs**.
8. Play or download generated audio from the story page.

## Backend compatibility

This UI is aligned with the current TTS Storyteller API routes:

- `GET /health`
- `GET/POST /stories`
- `GET/PUT /stories/{storyId}`
- `POST /stories/{storyId}/render`
- `POST /stories/{storyId}/generate`
- `GET /jobs`
- `GET /jobs/{jobId}`
- `POST /jobs/{jobId}/cancel`
- `GET/POST /voices`
- `POST /voices/clone`
- `GET/PUT/DELETE /voices/{voiceId}`
- `GET /voices/pools`
- `POST /audio/upload`
- `GET /audio/voices/{voiceId}.wav`
- `GET /audio/stories/{storyId}/full.wav`
- `GET /audio/stories/{storyId}/files`
- `GET /audio/stories/{storyId}/files/{filename}`

## Repository layout

```text
src/app/              Next.js App Router pages
src/components/       UI components and client-side forms/actions
src/components/ui/    shadcn-style primitives
src/hooks/            Shared client hooks (job polling)
src/lib/api.ts        TTS Storyteller API client
src/lib/api-schema.d.ts  GENERATED from the backend OpenAPI spec (npm run codegen)
src/lib/api-types.ts  Named type re-exports over the generated schema
```

## License

MIT. See `LICENSE`.

Third-party models and packages used by the backend are governed by their own licenses and terms. This UI does not redistribute model weights.
