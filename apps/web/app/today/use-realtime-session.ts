"use client";

import type { CreateRealtimeSessionResponse } from "@english-coach/contracts";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceOpeningProgress,
  canRequestHint,
  createCloseCommand,
  createHintCommand,
  createOpeningCommand,
  createOpeningProgress,
  parseLiveServerEvent,
  releaseRealtimeResources,
  safeSendLiveEvent,
  sendCloseLiveEvent,
  sendHintLiveEvent,
  setMicrophoneEnabled,
} from "./realtime-session-protocol";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const READY_TIMEOUT_MS = 30_000;
const COMMAND_TIMEOUT_MS = 10_000;
const OPENING_OUTPUT_TIMEOUT_MS = 15_000;
const CLOSE_TIMEOUT_MS = 15_000;

export type RealtimeSessionStatus =
  | "idle"
  | "requesting_microphone"
  | "connecting"
  | "opening"
  | "conversation_active"
  | "ending"
  | "completed"
  | "error";

interface RealtimeSessionState {
  status: RealtimeSessionStatus;
  error: string | null;
  sessionId: string | null;
  hintPending: boolean;
  audioBlocked: boolean;
}

const initialState: RealtimeSessionState = {
  status: "idle",
  error: null,
  sessionId: null,
  hintPending: false,
  audioBlocked: false,
};

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

  return { sessionId: response.sessionId, sdp: response.sdp };
}

async function readApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: unknown };
    if (typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // Use the controlled fallback below for a non-JSON response.
  }

  return "The server could not start a realtime session.";
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
  const [state, setState] = useState<RealtimeSessionState>(initialState);
  const stateRef = useRef(state);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeAttemptRef = useRef<symbol | null>(null);
  const openingEventIdRef = useRef<string | null>(null);
  const openingProgressRef = useRef(createOpeningProgress());
  const hintEventIdRef = useRef<string | null>(null);
  const commandTimeoutRef = useRef<number | null>(null);
  const openingOutputTimeoutRef = useRef<number | null>(null);
  const hintTimeoutRef = useRef<number | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);
  const eventSequenceRef = useRef(0);

  const transition = useCallback((nextState: RealtimeSessionState) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const updateState = useCallback(
    (update: (current: RealtimeSessionState) => RealtimeSessionState) => {
      transition(update(stateRef.current));
    },
    [transition],
  );

  const clearTimers = useCallback(() => {
    if (commandTimeoutRef.current !== null) {
      window.clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
    if (openingOutputTimeoutRef.current !== null) {
      window.clearTimeout(openingOutputTimeoutRef.current);
      openingOutputTimeoutRef.current = null;
    }
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    if (hintTimeoutRef.current !== null) {
      window.clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
  }, []);

  const releaseResources = useCallback(() => {
    clearTimers();
    activeAttemptRef.current = null;
    openingEventIdRef.current = null;
    openingProgressRef.current = createOpeningProgress();
    hintEventIdRef.current = null;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    releaseRealtimeResources({
      dataChannel: dataChannelRef.current,
      peerConnection: peerConnectionRef.current,
      localStream: localStreamRef.current,
      remoteAudio: remoteAudioRef.current,
    });

    dataChannelRef.current = null;
    peerConnectionRef.current = null;
    localStreamRef.current = null;
    remoteAudioRef.current = null;
  }, [clearTimers]);

  const nextEventId = useCallback((prefix: string) => {
    eventSequenceRef.current += 1;
    return `${prefix}_${eventSequenceRef.current}`;
  }, []);

  const failSession = useCallback(
    (message: string, attempt?: symbol) => {
      if (attempt && activeAttemptRef.current !== attempt) {
        return;
      }
      releaseResources();
      transition({ ...initialState, status: "error", error: message });
    },
    [releaseResources, transition],
  );

  const completeSession = useCallback(
    (message: string | null = null) => {
      releaseResources();
      transition({ ...initialState, status: "completed", error: message });
    },
    [releaseResources, transition],
  );

  const start = useCallback(
    async (topicId: string) => {
      releaseResources();
      const attempt = Symbol("realtime-attempt");
      activeAttemptRef.current = attempt;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      transition({ ...initialState, status: "requesting_microphone" });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (abortController.signal.aborted || activeAttemptRef.current !== attempt) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        localStreamRef.current = stream;
        setMicrophoneEnabled(stream, false);
        for (const track of stream.getAudioTracks()) {
          track.onended = () => {
            failSession("The microphone became unavailable. Connect it and try again.", attempt);
          };
        }

        const peerConnection = new RTCPeerConnection();
        peerConnectionRef.current = peerConnection;

        const remoteAudio = new Audio();
        remoteAudio.autoplay = true;
        remoteAudioRef.current = remoteAudio;
        remoteAudio.onerror = () => {
          updateState((current) => ({ ...current, audioBlocked: true }));
        };
        peerConnection.ontrack = (event) => {
          if (activeAttemptRef.current !== attempt) {
            return;
          }
          remoteAudio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
          void remoteAudio.play().then(
            () => {
              if (activeAttemptRef.current === attempt) {
                updateState((current) => ({ ...current, audioBlocked: false }));
              }
            },
            () => {
              if (activeAttemptRef.current === attempt) {
                updateState((current) => ({ ...current, audioBlocked: true }));
              }
            },
          );
        };

        for (const track of stream.getTracks()) {
          peerConnection.addTrack(track, stream);
        }

        const dataChannel = peerConnection.createDataChannel("oai-events");
        dataChannelRef.current = dataChannel;
        let providerStarted = false;
        let readySettled = false;
        let resolveReady: () => void = () => undefined;
        let rejectReady: (error: Error) => void = () => undefined;

        const ready = new Promise<void>((resolve, reject) => {
          resolveReady = resolve;
          rejectReady = reject;
        });
        void ready.catch(() => undefined);

        const settleReady = (error?: Error) => {
          if (readySettled) {
            return;
          }
          if (error) {
            readySettled = true;
            window.clearTimeout(readyTimeout);
            abortController.signal.removeEventListener("abort", onAbort);
            rejectReady(error);
            return;
          }
          if (providerStarted && peerConnection.connectionState === "connected") {
            readySettled = true;
            window.clearTimeout(readyTimeout);
            abortController.signal.removeEventListener("abort", onAbort);
            resolveReady();
          }
        };

        const onAbort = () =>
          settleReady(new DOMException("The connection attempt was cancelled.", "AbortError"));
        abortController.signal.addEventListener("abort", onAbort, { once: true });
        const readyTimeout = window.setTimeout(
          () => settleReady(new Error("The realtime session did not become ready in time.")),
          READY_TIMEOUT_MS,
        );

        peerConnection.onconnectionstatechange = () => {
          if (peerConnection.connectionState === "failed") {
            const message = "The WebRTC connection failed.";
            if (!readySettled) {
              settleReady(new Error(message));
            } else {
              failSession(`${message} Try starting again.`, attempt);
            }
            return;
          }
          settleReady();
        };

        dataChannel.onmessage = ({ data }) => {
          if (activeAttemptRef.current !== attempt) {
            return;
          }
          const event = parseLiveServerEvent(data);

          const recordOpeningSignal = (signal: "accepted" | "output_started") => {
            const result = advanceOpeningProgress(openingProgressRef.current, signal);
            openingProgressRef.current = result.progress;

            if (result.status === "conversation_active") {
              if (openingOutputTimeoutRef.current !== null) {
                window.clearTimeout(openingOutputTimeoutRef.current);
                openingOutputTimeoutRef.current = null;
              }
              if (stateRef.current.status === "opening") {
                updateState((current) => ({ ...current, status: result.status }));
              }
            }
          };

          if (event.type === "session.started") {
            providerStarted = true;
            settleReady();
            return;
          }

          if (event.type === "session.commentary.appended") {
            if (event.clientEventId === openingEventIdRef.current) {
              if (commandTimeoutRef.current !== null) {
                window.clearTimeout(commandTimeoutRef.current);
                commandTimeoutRef.current = null;
              }
              openingEventIdRef.current = null;
              recordOpeningSignal("accepted");
              if (
                stateRef.current.status === "opening" &&
                openingProgressRef.current.openingAccepted &&
                !openingProgressRef.current.openingOutputStarted &&
                openingOutputTimeoutRef.current === null
              ) {
                openingOutputTimeoutRef.current = window.setTimeout(() => {
                  openingOutputTimeoutRef.current = null;
                  failSession(
                    "The provider accepted the opening but did not start speaking. Try again.",
                    attempt,
                  );
                }, OPENING_OUTPUT_TIMEOUT_MS);
              }
            } else if (event.clientEventId === hintEventIdRef.current) {
              if (hintTimeoutRef.current !== null) {
                window.clearTimeout(hintTimeoutRef.current);
                hintTimeoutRef.current = null;
              }
              hintEventIdRef.current = null;
              updateState((current) => ({ ...current, hintPending: false }));
            }
            return;
          }

          if (
            event.type === "session.output_transcript.delta" &&
            stateRef.current.status === "opening"
          ) {
            recordOpeningSignal("output_started");
            return;
          }

          if (event.type === "session.closed") {
            if (stateRef.current.status === "ending") {
              completeSession();
            } else {
              failSession("The realtime provider ended the conversation.", attempt);
            }
            return;
          }

          if (event.type === "error") {
            if (event.clientEventId === hintEventIdRef.current) {
              if (hintTimeoutRef.current !== null) {
                window.clearTimeout(hintTimeoutRef.current);
                hintTimeoutRef.current = null;
              }
              hintEventIdRef.current = null;
              updateState((current) => ({
                ...current,
                hintPending: false,
                error: "The provider could not deliver that hint. You can keep talking or try again.",
              }));
              return;
            }
            if (!readySettled) {
              settleReady(new Error("The realtime provider could not start the session."));
            } else {
              failSession("The realtime provider reported a session error.", attempt);
            }
          }
        };

        dataChannel.onerror = () => {
          if (!readySettled) {
            settleReady(new Error("The realtime data channel failed."));
          } else {
            failSession("The realtime data channel failed.", attempt);
          }
        };
        dataChannel.onclose = () => {
          if (activeAttemptRef.current !== attempt) {
            return;
          }
          if (stateRef.current.status === "ending") {
            completeSession("The provider closed before final confirmation.");
          } else {
            failSession("The realtime data channel closed unexpectedly.", attempt);
          }
        };

        transition({ ...initialState, status: "connecting" });
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

        if (activeAttemptRef.current !== attempt || abortController.signal.aborted) {
          return;
        }

        setMicrophoneEnabled(stream, true);
        const openingEventId = nextEventId("opening");
        openingEventIdRef.current = openingEventId;
        openingProgressRef.current = createOpeningProgress();
        transition({
          ...initialState,
          status: "opening",
          sessionId: session.sessionId,
        });
        if (!safeSendLiveEvent(dataChannel, createOpeningCommand(openingEventId))) {
          failSession("The conversation opening could not be sent. Try starting again.", attempt);
          return;
        }
        commandTimeoutRef.current = window.setTimeout(
          () => failSession("The provider did not accept the conversation opening.", attempt),
          COMMAND_TIMEOUT_MS,
        );
      } catch (error) {
        if (abortController.signal.aborted || activeAttemptRef.current !== attempt) {
          return;
        }
        failSession(describeStartError(error), attempt);
      }
    },
    [
      completeSession,
      failSession,
      nextEventId,
      releaseResources,
      transition,
      updateState,
    ],
  );

  const requestHint = useCallback(() => {
    const dataChannel = dataChannelRef.current;
    if (
      !dataChannel ||
      !canRequestHint(
        stateRef.current.status === "conversation_active",
        dataChannel.readyState,
      )
    ) {
      updateState((current) => ({
        ...current,
        error: "A hint is available only during an active conversation.",
      }));
      return;
    }

    if (stateRef.current.hintPending) {
      return;
    }

    const eventId = nextEventId("hint");
    const outcome = sendHintLiveEvent(dataChannel, createHintCommand(eventId));
    if (!outcome.hintPending) {
      hintEventIdRef.current = null;
      updateState((current) => ({
        ...current,
        ...outcome,
      }));
      return;
    }
    hintEventIdRef.current = eventId;
    updateState((current) => ({ ...current, ...outcome }));
    hintTimeoutRef.current = window.setTimeout(() => {
      hintEventIdRef.current = null;
      hintTimeoutRef.current = null;
      updateState((current) => ({
        ...current,
        hintPending: false,
        error: "The hint request was not acknowledged. You can keep talking or try again.",
      }));
    }, COMMAND_TIMEOUT_MS);
  }, [nextEventId, updateState]);

  const endConversation = useCallback(() => {
    const dataChannel = dataChannelRef.current;
    const stream = localStreamRef.current;
    if (
      !["opening", "conversation_active"].includes(stateRef.current.status) ||
      !dataChannel ||
      dataChannel.readyState !== "open"
    ) {
      releaseResources();
      transition({ ...initialState, status: "completed" });
      return;
    }

    if (stream) {
      setMicrophoneEnabled(stream, false);
    }
    const closeStatus = sendCloseLiveEvent(
      dataChannel,
      createCloseCommand(nextEventId("close")),
      () => completeSession("The conversation ended locally without provider confirmation."),
    );
    if (closeStatus === "completed") {
      return;
    }
    transition({
      ...stateRef.current,
      status: closeStatus,
      hintPending: false,
      error: null,
    });
    closeTimeoutRef.current = window.setTimeout(
      () => completeSession("The provider did not confirm final session closure."),
      CLOSE_TIMEOUT_MS,
    );
  }, [completeSession, nextEventId, releaseResources, transition]);

  const resumeAudio = useCallback(async () => {
    const remoteAudio = remoteAudioRef.current;
    if (!remoteAudio) {
      return;
    }
    try {
      await remoteAudio.play();
      updateState((current) => ({ ...current, audioBlocked: false, error: null }));
    } catch {
      updateState((current) => ({
        ...current,
        audioBlocked: true,
        error: "Your browser is blocking conversation audio. Allow playback and try again.",
      }));
    }
  }, [updateState]);

  const reset = useCallback(() => {
    releaseResources();
    transition(initialState);
  }, [releaseResources, transition]);

  useEffect(() => releaseResources, [releaseResources]);

  return {
    ...state,
    microphoneEnabled: ["opening", "conversation_active"].includes(state.status),
    start,
    requestHint,
    endConversation,
    resumeAudio,
    reset,
  };
}
