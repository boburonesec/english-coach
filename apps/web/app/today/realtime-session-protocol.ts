export type ParsedLiveServerEvent =
  | { type: "session.started"; sessionId: string }
  | { type: "session.commentary.appended"; clientEventId: string | null }
  | { type: "session.output_transcript.delta" }
  | { type: "session.closed"; reason: string }
  | { type: "error"; clientEventId: string | null }
  | { type: "unknown" };

export interface RealtimeResources {
  dataChannel?: RTCDataChannel | null;
  peerConnection?: RTCPeerConnection | null;
  localStream?: MediaStream | null;
  remoteAudio?: HTMLAudioElement | null;
}

export type OpeningStatus = "opening" | "conversation_active";

export interface HintSendOutcome {
  hintPending: boolean;
  error: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function parseLiveServerEvent(data: unknown): ParsedLiveServerEvent {
  if (typeof data !== "string") {
    return { type: "unknown" };
  }

  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return { type: "unknown" };
  }

  if (!isRecord(value) || typeof value.type !== "string") {
    return { type: "unknown" };
  }

  if (value.type === "session.started" && isRecord(value.session)) {
    return typeof value.session.id === "string" && value.session.id
      ? { type: "session.started", sessionId: value.session.id }
      : { type: "unknown" };
  }

  if (value.type === "session.commentary.appended") {
    return {
      type: "session.commentary.appended",
      clientEventId:
        typeof value.client_event_id === "string" ? value.client_event_id : null,
    };
  }

  if (
    value.type === "session.output_transcript.delta" &&
    typeof value.delta === "string" &&
    value.delta.length > 0
  ) {
    return { type: "session.output_transcript.delta" };
  }

  if (value.type === "session.closed") {
    return {
      type: "session.closed",
      reason: typeof value.reason === "string" ? value.reason : "unknown",
    };
  }

  if (value.type === "error") {
    return {
      type: "error",
      clientEventId:
        typeof value.client_event_id === "string" ? value.client_event_id : null,
    };
  }

  return { type: "unknown" };
}

export function setMicrophoneEnabled(stream: MediaStream, enabled: boolean): void {
  for (const track of stream.getAudioTracks()) {
    track.enabled = enabled;
  }
}

export function canRequestHint(
  conversationIsActive: boolean,
  dataChannelState: "connecting" | "open" | "closing" | "closed" | null,
): boolean {
  return conversationIsActive && dataChannelState === "open";
}

export function safeSendLiveEvent(
  dataChannel: RTCDataChannel | null,
  event: string,
): boolean {
  if (!dataChannel || dataChannel.readyState !== "open") {
    return false;
  }

  try {
    dataChannel.send(event);
    return true;
  } catch {
    return false;
  }
}

export function sendHintLiveEvent(
  dataChannel: RTCDataChannel | null,
  event: string,
): HintSendOutcome {
  return safeSendLiveEvent(dataChannel, event)
    ? { hintPending: true, error: null }
    : {
        hintPending: false,
        error: "The hint request could not be sent. You can keep talking or try again.",
      };
}

export function sendCloseLiveEvent(
  dataChannel: RTCDataChannel | null,
  event: string,
  completeLocally: () => void,
): "ending" | "completed" {
  if (safeSendLiveEvent(dataChannel, event)) {
    return "ending";
  }

  completeLocally();
  return "completed";
}

export function advanceOpeningStatus(
  status: OpeningStatus,
  openingAccepted: boolean,
  event: ParsedLiveServerEvent,
): OpeningStatus {
  return status === "opening" &&
    openingAccepted &&
    event.type === "session.output_transcript.delta"
    ? "conversation_active"
    : status;
}

export function releaseRealtimeResources(resources: RealtimeResources): void {
  const { dataChannel, peerConnection, localStream, remoteAudio } = resources;

  if (dataChannel) {
    dataChannel.onmessage = null;
    dataChannel.onerror = null;
    dataChannel.onclose = null;
    if (dataChannel.readyState !== "closed") {
      dataChannel.close();
    }
  }

  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
  }

  for (const track of localStream?.getTracks() ?? []) {
    track.onended = null;
    track.stop();
  }

  if (remoteAudio) {
    remoteAudio.onerror = null;
    remoteAudio.pause();
    remoteAudio.srcObject = null;
  }
}

export function createOpeningCommand(eventId: string): string {
  return JSON.stringify({
    type: "session.commentary.append",
    event_id: eventId,
    delegation_id: null,
    content: "Begin the English conversation now, following the session instructions.",
  });
}

export function createHintCommand(eventId: string): string {
  return JSON.stringify({
    type: "session.commentary.append",
    event_id: eventId,
    delegation_id: null,
    content: "The learner explicitly requested one short hint to help them continue speaking.",
  });
}

export function createCloseCommand(eventId: string): string {
  return JSON.stringify({ type: "session.close", event_id: eventId });
}
