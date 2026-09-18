# Repository instructions

## Product principles

- Build conversation-first experiences: communication comes before perfection.
- The current focus is spontaneous speaking, especially clear and structured participation.
- Support both professional and general English.

## Source of truth

Before meaningful changes, consult the relevant files in `docs/product/`, `docs/architecture/`, and `docs/adr/`. Update them when an architectural decision changes.

## Architecture constraints

- This is a modular monolith. Do not introduce microservices without an ADR.
- Realtime media will connect directly between browser and AI provider; it must not pass through the backend.
- Keep post-session analysis separate from the realtime conversation path.
- Observation is not learner state. AI output is evidence, not automatically learner truth.

## MVP constraints

Avoid speculative infrastructure and features by default, including Kafka, Redis, vector databases, Elasticsearch, social features, heavy gamification, and external AI-agent integrations.

## Engineering behavior

- Inspect existing patterns before implementing.
- Prefer the smallest understandable implementation that satisfies the task.
- Avoid speculative abstractions and add tests for behavior changes.
- Run lint, typecheck, tests, and relevant builds before declaring completion.
