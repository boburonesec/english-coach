# English Coach

English Coach is a conversation-first product designed to help people become more comfortable using English in professional and everyday situations. The current vertical slice supports choosing a curated topic and holding a live, speech-to-speech English conversation over WebRTC.

## Workspace

- `apps/web` — Next.js topic-selection and live-conversation experience
- `apps/api` — NestJS control plane for topics and realtime session establishment
- `apps/worker` — runnable background-worker shell
- `packages/contracts` — shared API contracts
- `packages/domain` — shared product/domain types
- `packages/ai` — narrow OpenAI Live provider boundary
- `docs` — product, architecture, ADR, and development source of truth

## Quick start

Requirements: Node.js 24 LTS and pnpm 11.

```bash
pnpm install
pnpm dev
```

The web app runs at <http://localhost:3000> and the API at <http://localhost:3001>. See [local setup](docs/development/local-setup.md) for individual commands and verification checks.

## Repository checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Before making meaningful product or architecture changes, read `AGENTS.md` and the relevant documents under `docs/`.

## Current scope

Task 004 is implemented: the backend owns the conversation prompt and provider credentials, while browser audio travels directly to OpenAI Live. Live qualitative acceptance requires a valid `OPENAI_API_KEY`. Transcript persistence, session finalization, post-session review, and learner-state updates remain future vertical slices.
