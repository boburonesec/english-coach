"use client";

import type { CreateRealtimeSessionResponse } from "@english-coach/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const READY_TIMEOUT_MS = 30_000;

export type RealtimeSessionStatus =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

interface RealtimeSessionState {
  status: RealtimeSessionStatus;
  error: string | null;
  sessionId: string | null;
}

function parseSessionResponse(value: unknown): CreateRealtimeSessionResponse {
  if (!value || typeof value !== "object") {
    throw new Error("The server returned an invalid realtime session.");
  }

  const response = value as Record<string, unknown>;
  if (
    typeof response.sessionId !== "string" ||
    !response.sessionId.trim() ||
    typeof response.sdp !== "string" ||
    !response.sdp.trim().startsWith("v=0")
  ) {
    throw new Error("The server returned an invalid realtime session.");
  }

  return {
    sessionId: response.sessionId,
    sdp: response.sdp,
  };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // The controlled fallback below is sufficient for a non-JSON response.
  }

  return "The server could not start a realtime session.";
}

function waitForRealtimeReady(
  peerConnection: RTCPeerConnection,
  dataChannel: RTCDataChannel,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let sessionStarted = false;

    const cleanup = () => {
      clearTimeout(timeout);
      peerConnection.removeEventListener("connectionstatechange", onConnectionStateChange);
      dataChannel.removeEventListener("message", onMessage);
      dataChannel.removeEventListener("error", onDataChannelError);
      dataChannel.removeEventListener("close", onDataChannelClose);
      signal.removeEventListener("abort", onAbort);
    };

    const succeedIfReady = () => {
      if (peerConnection.connectionState === "connected" && sessionStarted) {
        cleanup();
        resolve();
      }
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    const onConnectionStateChange = () => {
      if (peerConnection.connectionState === "failed") {
        fail("The WebRTC connection failed.");
        return;
      }

      succeedIfReady();
    };

    const onMessage = (event: MessageEvent<unknown>) => {
      if (typeof event.data !== "string") {
        return;
      }

      try {
        const message = JSON.parse(event.data) as { type?: unknown };
        if (message.type === "session.started") {
          sessionStarted = true;
          succeedIfReady();
        } else if (message.type === "error" || message.type === "session.closed") {
          fail("The realtime provider ended the session before it was ready.");
        }
      } catch {
        // Ignore unrelated or malformed data-channel messages.
      }
    };

    const onDataChannelError = () => fail("The realtime data channel failed.");
    const onDataChannelClose = () => fail("The realtime data channel closed before startup.");
    const onAbort = () => {
      cleanup();
      reject(new DOMException("The connection attempt was cancelled.", "AbortError"));
    };
    const timeout = window.setTimeout(
      () => fail("The realtime session did not become ready in time."),
      READY_TIMEOUT_MS,
    );

    peerConnection.addEventListener("connectionstatechange", onConnectionStateChange);
    dataChannel.addEventListener("message", onMessage);
    dataChannel.addEventListener("error", onDataChannelError);
    dataChannel.addEventListener("close", onDataChannelClose);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function waitForIceGathering(
  peerConnection: RTCPeerConnection,
  signal: AbortSignal,
): Promise<void> {
  if (peerConnection.iceGatheringState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeout);
      peerConnection.removeEventListener("icegatheringstatechange", onStateChange);
      signal.removeEventListener("abort", onAbort);
    };
    const onStateChange = () => {
      if (peerConnection.iceGatheringState === "complete") {
        cleanup();
        resolve();
      }
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException("The connection attempt was cancelled.", "AbortError"));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("The browser timed out while preparing the WebRTC connection."));
    }, 10_000);

    peerConnection.addEventListener("icegatheringstatechange", onStateChange);
    signal.addEventListener("abort", onAbort, { once: true });
    onStateChange();
  });
}

function describeStartError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Microphone permission was denied. Allow microphone access and try again.";
    }

    if (error.name === "NotFoundError") {
      return "No microphone is available. Connect one and try again.";
    }

    if (error.name === "AbortError") {
      return "The connection attempt was cancelled.";
    }
  }

  if (error instanceof TypeError) {
    return "Could not reach the realtime service. Check that the API is running and try again.";
  }

  return error instanceof Error ? error.message : "The realtime session could not start.";
}

export function useRealtimeSession() {
  const [state, setState] = useState<RealtimeSessionState>({
    status: "idle",
    error: null,
    sessionId: null,
  });
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const releaseResources = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const dataChannel = dataChannelRef.current;
    dataChannelRef.current = null;
    if (dataChannel && dataChannel.readyState !== "closed") {
      dataChannel.close();
    }

    const peerConnection = peerConnectionRef.current;
    peerConnectionRef.current = null;
    if (peerConnection) {
      peerConnection.ontrack = null;
      peerConnection.onconnectionstatechange = null;
      peerConnection.close();
    }

    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;

    const remoteAudio = remoteAudioRef.current;
    remoteAudioRef.current = null;
    if (remoteAudio) {
      remoteAudio.pause();
      remoteAudio.srcObject = null;
    }
  }, []);

  const disconnect = useCallback(() => {
    setState((current) => ({ ...current, status: "disconnecting", error: null }));
    releaseResources();
    setState({ status: "idle", error: null, sessionId: null });
  }, [releaseResources]);

  const start = useCallback(
    async (topicId: string) => {
      releaseResources();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setState({ status: "requesting_microphone", error: null, sessionId: null });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (abortController.signal.aborted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        const peerConnection = new RTCPeerConnection();
        peerConnectionRef.current = peerConnection;

        const remoteAudio = new Audio();
        remoteAudio.autoplay = true;
        remoteAudioRef.current = remoteAudio;
        peerConnection.ontrack = (event) => {
          remoteAudio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          void remoteAudio.play().catch(() => undefined);
        };

        for (const track of stream.getTracks()) {
          peerConnection.addTrack(track, stream);
          track.enabled = false;
        }

        const dataChannel = peerConnection.createDataChannel("oai-events");
        dataChannelRef.current = dataChannel;
        const ready = waitForRealtimeReady(
          peerConnection,
          dataChannel,
          abortController.signal,
        );
        void ready.catch(() => undefined);

        setState({ status: "connecting", error: null, sessionId: null });
        const offer = await peerConnection.createOffer({ offerToReceiveAudio: true });
        await peerConnection.setLocalDescription(offer);
        await waitForIceGathering(peerConnection, abortController.signal);

        const sdp = peerConnection.localDescription?.sdp;
        if (!sdp) {
          throw new Error("The browser could not create a WebRTC offer.");
        }

        const response = await fetch(`${API_URL}/realtime/sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topicId, sdp }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(await readApiError(response));
        }

        const session = parseSessionResponse(await response.json());
        await peerConnection.setRemoteDescription({ type: "answer", sdp: session.sdp });
        await ready;

        if (abortController.signal.aborted) {
          return;
        }

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "failed") {
            releaseResources();
            setState({
              status: "error",
              error: "The WebRTC connection was lost. Try starting again.",
              sessionId: null,
            });
          }
        };
        setState({ status: "connected", error: null, sessionId: session.sessionId });
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        releaseResources();
        setState({
          status: "error",
          error: describeStartError(error),
          sessionId: null,
        });
      }
    },
    [releaseResources],
  );

  const reset = useCallback(() => {
    releaseResources();
    setState({ status: "idle", error: null, sessionId: null });
  }, [releaseResources]);

  useEffect(() => releaseResources, [releaseResources]);

  return {
    ...state,
    start,
    disconnect,
    reset,
  };
}
