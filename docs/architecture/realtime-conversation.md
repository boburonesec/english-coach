# Realtime conversation

Realtime speech-to-speech over WebRTC is the primary conversation path. Task 003 implements connection establishment and cleanup; conversation behavior remains intentionally disabled until Task 004.

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

## Implemented establishment flow

1. The browser requests microphone access, creates an `RTCPeerConnection`, adds the audio track in a disabled state, and creates the `oai-events` data channel.
2. The browser creates an SDP offer, sets it locally, waits for ICE gathering to complete, and sends only `{ topicId, sdp }` to `POST /realtime/sessions`.
3. The backend validates the request and resolves the curated topic by ID. Browser-supplied topic text is never trusted.
4. The concrete provider adapter calls OpenAI Live `POST /live/sessions` through the official SDK with the selected topic context, model configuration, and WebRTC offer.
5. The backend returns only `{ sessionId, sdp }`, where `sdp` is the provider answer.
6. The browser applies the remote answer and waits for both the WebRTC connection and the Live `session.started` data-channel event before showing `connected`.
7. Disconnect, navigation, retry, or failure closes the data channel and peer connection, stops local media tracks, and releases remote audio resources.

The backend is the trusted control plane. `OPENAI_API_KEY` and provider response details remain server-side. The browser receives only the normalized session identifier and SDP answer needed to complete the peer connection.

The backend does not proxy realtime audio. Direct browser-to-provider media avoids avoidable latency, bandwidth, and operational complexity. The microphone track is negotiated but kept disabled during Task 003, and the provider is not prompted to begin a conversation.

The adapter follows the current [OpenAI Live API](https://developers.openai.com/api/reference/typescript/resources/live): WebRTC session creation starts the session, and `session.started` signals readiness; the browser does not send another `session.start`. Transcript capture, session finalization, conversation behavior, and learning review remain later slices.
