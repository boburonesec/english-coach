# ADR 004: Post-session analysis

## Status

Accepted

## Context

Deep review and coaching require richer reasoning than a live conversation turn. Running them in the realtime hot path would add latency, compete with the conversation model's immediate role, and encourage unfiltered observations to become learner truth.

## Decision

Keep the realtime conversation focused on natural interaction and requested hints. Finalize session data first, then run detailed review, select one to three coaching priorities, and update learner-state evidence outside the realtime path.

## Consequences

Realtime interactions stay responsive and review can be retried or improved independently. Feedback arrives after the session rather than continuously. The post-session workflow must preserve traceability between observations, selected priorities, and learner-state evidence.
