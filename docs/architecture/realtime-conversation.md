# Realtime conversation

Realtime speech-to-speech over WebRTC is the primary conversation path. Task 004 enables the first live English conversation while keeping review, persistence, and learner-state work outside the realtime path.

```text
Browser
   |
   | control/signaling
   v
Backend
   |
   v
OpenAI Live

Browser <==== WebRTC audio ====> OpenAI Live
```

## Implemented conversation flow

1. The browser requests microphone access, creates an `RTCPeerConnection`, adds the audio track in a disabled state, and creates the `oai-events` data channel.
2. The browser creates an SDP offer, sets it locally, waits for ICE gathering to complete, and sends only `{ topicId, sdp }` to `POST /realtime/sessions`.
3. The backend validates the request and resolves the curated topic by ID. Browser-supplied topic text is never trusted.
4. The backend builds the conversation instructions from the trusted topic. They define an adult B1-level discussion, a concise opening, communication-before-correction behavior, varied follow-ups, and explicit-request-only hints.
5. The concrete provider adapter calls OpenAI Live `POST /live/sessions` through the official SDK with those server-owned instructions, a narrow data-channel event allowlist, model configuration, and the WebRTC offer.
6. The backend returns only `{ sessionId, sdp }`, where `sdp` is the provider answer.
7. The browser applies the remote answer and waits for both the WebRTC connection and the Live `session.started` data-channel event before enabling meaningful microphone transmission.
8. The browser enables the negotiated microphone track and sends a fixed `session.commentary.append` signal asking the model to begin. The full prompt and trusted topic remain server-side.
9. A Hint click sends another fixed commentary signal. The server-owned prompt limits the result to a short phrase starter, word, or sentence structure and prohibits automatic hints.
10. The opening acknowledgement only confirms that the command entered the provider timeline. The UI remains in `opening` until both command acceptance and the first non-empty `session.output_transcript.delta` have arrived, in either order. After acceptance, a bounded watchdog fails and cleans up the session if assistant output never starts; it does not estimate audio playback completion.
11. End Conversation disables the microphone immediately, sends `session.close`, waits for `session.closed` where possible, then releases all local and remote media resources. If the close command cannot be sent, local cleanup completes immediately.

The backend is the trusted control plane. `OPENAI_API_KEY` and provider response details remain server-side. The browser receives only the normalized session identifier and SDP answer needed to complete the peer connection.

The backend does not proxy realtime audio. Direct browser-to-provider media avoids avoidable latency, bandwidth, and operational complexity. Transcript deltas are not persisted or presented; Task 005 owns transcript and session finalization design.

The adapter follows the current [OpenAI Live API](https://developers.openai.com/api/reference/typescript/resources/live): WebRTC session creation starts the session, and `session.started` signals readiness; the browser does not send another `session.start`. Current Live sessions do not emit an opening-audio-completed event. The implementation therefore does not invent a timing delay or claim exact turn-state precision: the microphone is disabled through connection startup, then enabled when the ready session is asked to open the conversation, as required by the provider's greeting guidance. `session.commentary.appended` is treated only as command acceptance; the first assistant output transcript delta is the available evidence that opening output has begun, not that playback has finished.
