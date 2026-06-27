import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
  buttonClassName?: string;
}

/**
 * Voice input powered by Google Gemini (gemini-3.1-flash-live-preview).
 *
 * Records mic audio in the browser, then POSTs it to the backend
 * `/api/voice/transcribe` endpoint, which transcribes it with Gemini.
 * (Replaces the previous ElevenLabs Scribe integration.)
 */
const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  className = '',
  buttonClassName = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
        streamRef.current?.getTracks().forEach((t) => t.stop());
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const transcribe = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const form = new FormData();
      form.append('file', blob, 'recording.webm');
      const res = await fetch('/api/voice/transcribe', { method: 'POST', body: form });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail?.detail || 'Transcription failed');
      }
      const data = await res.json();
      if (data?.text) onTranscript(data.text);
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const startRecording = async () => {
    try {
      setError(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) transcribe(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Microphone access denied');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch (err) {
      console.error('Error stopping recording:', err);
      setError('Failed to stop recording');
    } finally {
      setIsRecording(false);
    }
  };

  const handleClick = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isProcessing && !isRecording}
        className={`
          relative group transition-all duration-200
          ${isRecording
            ? 'text-red-400 hover:text-red-300 animate-pulse'
            : isProcessing
            ? 'text-blue-400'
            : 'text-gray-400 hover:text-blue-400'
          }
          ${buttonClassName}
        `}
        title={isRecording ? 'Click to stop recording' : 'Click to start voice input'}
      >
        {isProcessing && !isRecording ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isRecording ? (
          <div className="relative">
            <MicOff className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
          </div>
        ) : (
          <Mic className="w-5 h-5" />
        )}

        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          {isRecording ? 'Stop recording' : isProcessing ? 'Transcribing...' : 'Voice input'}
        </div>
      </button>

      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center space-x-2 text-red-400 text-xs whitespace-nowrap">
          <Volume2 className="w-3 h-3 animate-pulse" />
          <span>Recording...</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded max-w-xs text-center z-50">
          {error}
        </div>
      )}
    </div>
  );
};

export default VoiceInput;
