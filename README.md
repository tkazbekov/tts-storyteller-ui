This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app). It is the frontend for the [qwen3-tts](https://github.com/) API (multi-voice story generation).

## Configuration

Copy `.env.example` to `.env.local` and set the API base URL if needed:

- `NEXT_PUBLIC_API_URL` – base URL of the qwen3-tts API (default: `http://localhost:8000`). If unset, the app uses the `/api` rewrite to proxy to `http://localhost:8000`.

## Running for development

The UI talks to the **qwen3-tts API** at `http://localhost:8000`. You need both running.

**Option A – Two terminals**

1. **API** (in the `qwen3-tts` repo):
   ```bash
   cd /path/to/qwen3-tts
   source env.sh
   make run-api
   ```
2. **Frontend** (in this repo):
   ```bash
   npm run dev
   ```

**Option B – One command** (if `qwen3-tts` is a sibling directory of `storymaker-ui`):
   ```bash
   npm run dev:all
   ```
   This starts the API and Next together (requires `concurrently`).

Then open [http://localhost:3000](http://localhost:3000). The API runs at [http://localhost:8000](http://localhost:8000).

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
