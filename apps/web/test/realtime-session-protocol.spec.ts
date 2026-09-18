import { describe, expect, it, vi } from "vitest";
import {
  advanceOpeningStatus,
  canRequestHint,
  createHintCommand,
  parseLiveServerEvent,
  releaseRealtimeResources,
  safeSendLiveEvent,
  sendCloseLiveEvent,
  sendHintLiveEvent,
  setMicrophoneEnabled,
} from "../app/today/realtime-session-protocol";

describe("realtime session protocol", () => {
  it("keeps microphone tracks disabled until explicitly activated", () => {
    const audioTrack = { enabled: true };
    const stream = {
      getAudioTracks: () => [audioTrack],
    } as unknown as MediaStream;

    setMicrophoneEnabled(stream, false);
    expect(audioTrack.enabled).toBe(false);

    setMicrophoneEnabled(stream, true);
    expect(audioTrack.enabled).toBe(true);
  });

  it("ignores malformed and unknown provider events safely", () => {
    expect(parseLiveServerEvent("not-json")).toEqual({ type: "unknown" });
    expect(parseLiveServerEvent(JSON.stringify({ type: "future.event", value: 1 }))).toEqual({
      type: "unknown",
    });
    expect(
      parseLiveServerEvent(JSON.stringify({ type: "session.output_transcript.delta" })),
    ).toEqual({ type: "unknown" });
  });

  it("keeps opening pending on acknowledgement and activates on output evidence", () => {
    const acknowledged = parseLiveServerEvent(
      JSON.stringify({
        type: "session.commentary.appended",
        client_event_id: "opening_1",
      }),
    );
    const output = parseLiveServerEvent(
      JSON.stringify({ type: "session.output_transcript.delta", delta: "Hello" }),
    );

    expect(advanceOpeningStatus("opening", true, acknowledged)).toBe("opening");
    expect(advanceOpeningStatus("opening", false, output)).toBe("opening");
    expect(advanceOpeningStatus("opening", true, output)).toBe("conversation_active");
  });

  it("creates a narrow explicit-hint signal", () => {
    expect(JSON.parse(createHintCommand("hint_1"))).toEqual({
      type: "session.commentary.append",
      event_id: "hint_1",
      delegation_id: null,
      content: "The learner explicitly requested one short hint to help them continue speaking.",
    });
  });

  it("rejects hint requests outside an open live conversation", () => {
    expect(canRequestHint(false, null)).toBe(false);
    expect(canRequestHint(false, "open")).toBe(false);
    expect(canRequestHint(true, "closed")).toBe(false);
    expect(canRequestHint(true, "open")).toBe(true);
  });

  it("contains a throwing data-channel send and reports failure", () => {
    const send = vi.fn(() => {
      throw new DOMException("The channel closed during send.", "InvalidStateError");
    });
    const dataChannel = {
      readyState: "open",
      send,
    } as unknown as RTCDataChannel;

    expect(safeSendLiveEvent(dataChannel, "{}")).toBe(false);
    expect(send).toHaveBeenCalledOnce();
  });

  it("clears pending hint state after a send failure", () => {
    const dataChannel = {
      readyState: "open",
      send: vi.fn(() => {
        throw new DOMException("The channel closed during send.", "InvalidStateError");
      }),
    } as unknown as RTCDataChannel;

    expect(sendHintLiveEvent(dataChannel, "{}")).toEqual({
      hintPending: false,
      error: "The hint request could not be sent. You can keep talking or try again.",
    });
  });

  it("completes and cleans up immediately after a close send failure", () => {
    const stop = vi.fn();
    const closePeer = vi.fn();
    const localStream = {
      getTracks: () => [{ onended: vi.fn(), stop }],
    } as unknown as MediaStream;
    const peerConnection = {
      close: closePeer,
      ontrack: vi.fn(),
      onconnectionstatechange: vi.fn(),
    } as unknown as RTCPeerConnection;
    const dataChannel = {
      readyState: "open",
      send: vi.fn(() => {
        throw new DOMException("The channel closed during send.", "InvalidStateError");
      }),
      close: vi.fn(),
      onmessage: vi.fn(),
      onerror: vi.fn(),
      onclose: vi.fn(),
    } as unknown as RTCDataChannel;
    const completeLocally = vi.fn(() => {
      releaseRealtimeResources({ dataChannel, peerConnection, localStream });
    });

    expect(sendCloseLiveEvent(dataChannel, "{}", completeLocally)).toBe("completed");
    expect(completeLocally).toHaveBeenCalledOnce();
    expect(stop).toHaveBeenCalledOnce();
    expect(closePeer).toHaveBeenCalledOnce();
  });

  it("does not send through a channel that is no longer open", () => {
    const send = vi.fn();
    const dataChannel = {
      readyState: "closing",
      send,
    } as unknown as RTCDataChannel;

    expect(safeSendLiveEvent(dataChannel, "{}")).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("stops media and closes every active resource", () => {
    const stop = vi.fn();
    const closeChannel = vi.fn();
    const closePeer = vi.fn();
    const pause = vi.fn();
    const track = { onended: vi.fn(), stop };
    const dataChannel = {
      readyState: "open",
      close: closeChannel,
      onmessage: vi.fn(),
      onerror: vi.fn(),
      onclose: vi.fn(),
    } as unknown as RTCDataChannel;
    const peerConnection = {
      close: closePeer,
      ontrack: vi.fn(),
      onconnectionstatechange: vi.fn(),
    } as unknown as RTCPeerConnection;
    const localStream = {
      getTracks: () => [track],
    } as unknown as MediaStream;
    const remoteAudio = {
      pause,
      srcObject: {} as MediaStream,
      onerror: vi.fn(),
    } as unknown as HTMLAudioElement;

    releaseRealtimeResources({ dataChannel, peerConnection, localStream, remoteAudio });

    expect(stop).toHaveBeenCalledOnce();
    expect(closeChannel).toHaveBeenCalledOnce();
    expect(closePeer).toHaveBeenCalledOnce();
    expect(pause).toHaveBeenCalledOnce();
    expect(remoteAudio.srcObject).toBeNull();
  });
});
