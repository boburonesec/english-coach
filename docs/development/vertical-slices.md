# Vertical slice order

Each slice should deliver a narrow end-to-end behavior and leave the application in a working, testable state. Avoid creating infrastructure or abstractions solely for a later slice.

1. **Repository/bootstrap — implemented.** Workspace, runnable shells, quality checks, and source-of-truth documentation are in place.
2. **Topic selection — implemented.** `/today` loads a deterministic three-topic catalogue from `GET /topics/options`; the learner's choice remains frontend-local and exposes the ID for the next slice.
3. **Realtime session establishment — implemented; live acceptance requires credentials.** The browser sends its SDP offer and selected topic ID through the backend control plane, applies the OpenAI Live answer, waits for `session.started`, and can disconnect cleanly. The microphone stays muted and conversation behavior remains disabled in this slice.
4. **Realtime voice conversation** — direct browser-to-provider WebRTC conversation with the smallest useful controls.
5. **Transcript/session finalization** — capture and finalize the minimum session record needed for learning.
6. **Post-session review job** — analyze completed sessions outside the realtime path with observable retry behavior.
7. **Coaching priority selection** — choose one to three high-value priorities from review observations.
8. **Focused practice** — require active production against selected priorities.
9. **Learner-state update** — update evidence-backed beliefs without turning single observations into permanent labels.
10. **Next-session recall/reuse** — deliberately reuse prior learning in a different context.
11. **Progress/assessment later** — expose progress only after the evidence model and learning loop are validated.

Adaptive session intensity, broad assessment dashboards, and additional exercise formats remain later work unless a slice proves they are necessary.
