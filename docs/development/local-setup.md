# Local setup

## Requirements

- Node.js 24 LTS
- pnpm 11 (the exact expected version is in the root `packageManager` field)

No database or container runtime is required. Topic selection runs without external services. A real WebRTC conversation requires an OpenAI project API key, GPT-Live access, microphone access, and browser audio playback on localhost or HTTPS.

## Install

```bash
corepack enable
pnpm install
```

## Realtime configuration

Create the API environment file:

```bash
cp apps/api/.env.example apps/api/.env
```

Set `OPENAI_API_KEY` in `apps/api/.env`. `OPENAI_LIVE_MODEL` defaults to `gpt-live-1`, and `WEB_ORIGIN` defaults to `http://localhost:3000`. Never place the API key in the web app or a `NEXT_PUBLIC_*` variable.

The web app defaults to `http://localhost:3001` for API requests. To override it:

```bash
cp apps/web/.env.example apps/web/.env.local
```

## Run

Start all application development processes:

```bash
pnpm dev
```

Or run one process:

```bash
pnpm --filter @english-coach/web dev
pnpm --filter @english-coach/api dev
pnpm --filter @english-coach/worker dev
```

The web app defaults to <http://localhost:3000>. The API defaults to <http://localhost:3001>; `GET /health` returns `{ "status": "ok" }`. The worker prints that it is idle because no job system is configured yet. Without `OPENAI_API_KEY`, topic selection remains available and `POST /realtime/sessions` returns a controlled `503` response.

For a live smoke test, choose a topic on `/today`, start the conversation, grant microphone permission, listen for the concise opening question, speak for several turns, request one Hint, and end the conversation. Confirm the browser microphone indicator disappears and that a second conversation starts without refreshing. If autoplay is blocked, use the displayed Play audio action.

## Verify

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run production builds with each workspace's `start` command after `pnpm build`:

```bash
pnpm --filter @english-coach/web start
pnpm --filter @english-coach/api start
pnpm --filter @english-coach/worker start
```

PostgreSQL, Prisma, and pg-boss remain intentionally unwired. OpenAI Live now handles the in-session spoken conversation and explicit hints. No transcript, review, conversation record, or learner state is persisted.
