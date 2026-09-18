# ADR 002: Realtime speech-to-speech

## Status

Accepted

## Context

Spontaneous speaking practice depends on turn timing, interruption handling, tone, and conversational flow. A pipeline assembled from separate speech-to-text, language-model, and text-to-speech stages adds latency and coordination points to every turn.

## Decision

Use a realtime speech-to-speech provider as the primary conversation path. The browser will exchange media directly with the provider over WebRTC, with the backend acting as the trusted control plane.

## Consequences

Conversation can feel more natural and responsive, and the backend avoids media proxying. The product depends on realtime provider capabilities and must deliberately capture the events or transcript required for later review. This decision does not prevent offline transcription or other focused processing where it has clear learning value.
