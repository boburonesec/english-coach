import { describe, expect, it, vi } from "vitest";
import {
  canRequestHint,
  createHintCommand,
  parseLiveServerEvent,
  releaseRealtimeResources,
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
