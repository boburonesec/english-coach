# Learner model

The learner model is a changing, evidence-backed view of what will most improve a learner's next conversations. This document defines concepts only; it deliberately does not define a database schema.

> observation != learner state

An observation describes something that happened in one session and context. Learner state is a changing belief supported by evidence, not a permanent label. AI review output is candidate evidence and must not automatically become learner truth.

## Conceptual signals

- **Speaking bottlenecks:** current limits on clarity, structure, fluency, interaction, or language choice.
- **Listening bottlenecks:** current limits on following meaning, pace, detail, or implied intent.
- **Recurring language patterns:** behavior seen often enough to investigate across sessions.
- **Activation:** whether useful language is merely recognized or can be produced spontaneously.
- **Evidence:** a dated, contextual observation that supports or challenges a belief.
- **Confidence:** how strongly the available evidence supports that belief.
- **Context diversity:** how varied the situations are in which the behavior has appeared.

## Learning status

- **Primary focus:** one of the few items selected for immediate work.
- **Strengthening:** improving but still needing deliberate recall and varied reuse.
- **Stable:** performed reliably across suitable contexts.
- **Maintenance:** recalled occasionally so stable capability remains available.

State should be revised when new evidence contradicts old beliefs, not accumulated as permanent deficits. The model should retain the minimum content needed to support learning decisions and avoid preserving unrelated sensitive details from conversations.
