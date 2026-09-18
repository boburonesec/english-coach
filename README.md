# English Coach

English Coach is a conversation-first product designed to help people become more comfortable using English in professional and everyday situations. This repository currently contains the product foundation only; realtime conversation is intentionally not implemented yet.

## Workspace

- `apps/web` — minimal Next.js web application
- `apps/api` — NestJS control-plane API with a health endpoint
- `apps/worker` — runnable background-worker shell
- `packages/contracts` — future cross-boundary contracts
- `packages/domain` — future shared product/domain types
- `packages/ai` — future narrow AI-provider boundary
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
