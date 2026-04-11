import { useSyncExternalStore } from "react";
import type { StreamDiagnostics } from "../gfn/webrtcClient";

type Listener = () => void;

interface StreamDiagnosticsState {
  diagnostics: StreamDiagnostics;
  hasReceivedFrames: boolean;
}

function defaultDiagnostics(): StreamDiagnostics {
  return {
    connectionState: "closed",
    inputReady: false,
    connectedGamepads: 0,
    resolution: "",
    codec: "",
    isHdr: false,
    bitrateKbps: 0,
    decodeFps: 0,
    renderFps: 0,
    packetsLost: 0,
    packetsReceived: 0,
    packetLossPercent: 0,
    jitterMs: 0,
    rttMs: 0,
    framesReceived: 0,
    framesDecoded: 0,
    framesDropped: 0,
    decodeTimeMs: 0,
    renderTimeMs: 0,
    jitterBufferDelayMs: 0,
    inputQueueBufferedBytes: 0,
    inputQueuePeakBufferedBytes: 0,
    inputQueueDropCount: 0,
    inputQueueMaxSchedulingDelayMs: 0,
    gpuType: "",
    serverRegion: "",
    micState: "uninitialized",
    micEnabled: false,
  };
}

function createStore() {
  let state: StreamDiagnosticsState = {
    diagnostics: defaultDiagnostics(),
    hasReceivedFrames: false,
  };
  const listeners = new Set<Listener>();

  const emit = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    getSnapshot: (): StreamDiagnosticsState => state,
    getDiagnostics: (): StreamDiagnostics => state.diagnostics,
    hasReceivedFrames: (): boolean => state.hasReceivedFrames,
    subscribe: (listener: Listener): (() => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set: (diagnostics: StreamDiagnostics) => {
      const hasFrames = diagnostics.framesDecoded > 0 && diagnostics.connectionState === "connected";
      state = {
        diagnostics,
        hasReceivedFrames: state.hasReceivedFrames || hasFrames,
      };
      emit();
    },
    reset: () => {
      state = {
        diagnostics: defaultDiagnostics(),
        hasReceivedFrames: false,
      };
      emit();
    },
  };
}

export type StreamDiagnosticsStore = ReturnType<typeof createStore>;

export function createStreamDiagnosticsStore(): StreamDiagnosticsStore {
  return createStore();
}

export function useStreamDiagnosticsStore(store: StreamDiagnosticsStore): StreamDiagnosticsState {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}

export function useStreamDiagnosticsSelector<T>(
  store: StreamDiagnosticsStore,
  selector: (state: StreamDiagnostics) => T
): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getDiagnostics()),
    () => selector(store.getDiagnostics())
  );
}
