import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';

/**
 * LiveNarrationToggle
 * -------------------
 * A small, self-contained mic/speaker toggle that narrates the Sky Launchpad
 * self-improvement loop in real time.
 *
 * When enabled it opens a WebSocket to `${apiBase}/api/live/narrate` and:
 *   - speaks narration via the browser's SpeechSynthesis (server sends text only)
 *     (decoded via the Web Audio API), and
 *   - falls back to `window.speechSynthesis.speak()` for text-only frames
 *     (when the backend could not produce audio).
 *
 * No external state libraries — React hooks only.
 */

interface LiveNarrationToggleProps {
  /** Base URL for the API (e.g. "http://localhost:8000"). Defaults to ''. */
  apiBase?: string;
}

// Legacy PCM decoder (inert): the server now streams text only, spoken via SpeechSynthesis.
const PCM_SAMPLE_RATE = 24000;

interface NarrationFrame {
  type: 'ready' | 'narration';
  phase?: string;
  text?: string;
  audio?: boolean;
  server_audio?: boolean;
  model?: string;
}

const LiveNarrationToggle: React.FC<LiveNarrationToggleProps> = ({ apiBase = '' }) => {
  const [enabled, setEnabled] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastPhase, setLastPhase] = useState<string>('');

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  // Tracks the scheduled end time so sequential chunks play back-to-back.
  const playheadRef = useRef<number>(0);

  const getAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      audioCtxRef.current = new Ctor();
    }
    return audioCtxRef.current;
  }, []);

  // Decode a raw 16-bit PCM little-endian mono buffer and schedule playback.
  const playPcmChunk = useCallback(
    (buffer: ArrayBuffer) => {
      const ctx = getAudioContext();
      if (!ctx || buffer.byteLength < 2) return;

      const pcm = new Int16Array(buffer);
      const audioBuffer = ctx.createBuffer(1, pcm.length, PCM_SAMPLE_RATE);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) {
        channel[i] = pcm[i] / 0x8000; // normalize to [-1, 1]
      }

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      const now = ctx.currentTime;
      const startAt = Math.max(now, playheadRef.current);
      source.start(startAt);
      playheadRef.current = startAt + audioBuffer.duration;
    },
    [getAudioContext]
  );

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    } catch {
      /* SpeechSynthesis unavailable — silently ignore. */
    }
  }, []);

  const closeSocket = useCallback(() => {
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {
        /* ignore */
      }
      wsRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
    }
    playheadRef.current = 0;
  }, []);

  const openSocket = useCallback(() => {
    if (typeof window === 'undefined') return;

    // Build ws(s):// URL from apiBase (which may be empty -> same origin).
    let base = apiBase;
    if (!base) {
      base = window.location.origin;
    }
    const wsUrl =
      base.replace(/^http/i, 'ws').replace(/\/+$/, '') + '/api/live/narrate';

    setConnecting(true);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setConnecting(false);
      setEnabled(false);
      return;
    }
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnecting(false);
      // Resume the AudioContext within the user-gesture-initiated flow.
      const ctx = getAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => undefined);
      }
    };

    ws.onmessage = (ev: MessageEvent) => {
      if (ev.data instanceof ArrayBuffer) {
        // Binary audio frame (legacy path; server no longer sends these).
        playPcmChunk(ev.data);
        return;
      }
      // JSON text frame.
      try {
        const frame: NarrationFrame = JSON.parse(ev.data as string);
        if (frame.type === 'narration') {
          if (frame.phase) setLastPhase(frame.phase);
          // If the backend did NOT stream audio, speak it in the browser.
          if (!frame.audio && frame.text) {
            speakText(frame.text);
          }
        }
      } catch {
        /* non-JSON text frame — ignore */
      }
    };

    ws.onerror = () => {
      setConnecting(false);
    };

    ws.onclose = () => {
      setConnecting(false);
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [apiBase, getAudioContext, playPcmChunk, speakText]);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      if (next) {
        openSocket();
      } else {
        closeSocket();
      }
      return next;
    });
  }, [openSocket, closeSocket]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      closeSocket();
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => undefined);
        audioCtxRef.current = null;
      }
    };
  }, [closeSocket]);

  const Icon = connecting ? Loader2 : enabled ? Volume2 : VolumeX;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={enabled}
      aria-label={enabled ? 'Disable live narration' : 'Enable live narration'}
      title={
        enabled
          ? lastPhase
            ? `Live narration on (${lastPhase})`
            : 'Live narration on'
          : 'Enable live narration'
      }
      className={[
        'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1',
        enabled
          ? 'border-blue-500 bg-blue-50 text-blue-700 focus:ring-blue-400'
          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 focus:ring-gray-300',
      ].join(' ')}
    >
      <Icon className={`h-4 w-4 ${connecting ? 'animate-spin' : ''}`} aria-hidden="true" />
      <span>{enabled ? 'Narrating' : 'Narrate'}</span>
    </button>
  );
};

export default LiveNarrationToggle;
