import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { Scribe, RealtimeEvents } from '@elevenlabs/client';

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  className?: string;
  buttonClassName?: string;
}

const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  className = '',
  buttonClassName = ''
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectionRef = useRef<any | null>(null);
  const transcriptRef = useRef<string>('');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionRef.current) {
        try {
          connectionRef.current.close();
        } catch (e) {
          console.error('Error closing connection:', e);
        }
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setIsProcessing(true);
      transcriptRef.current = '';

      // Get single-use token from backend
      const response = await fetch('/api/scribe-token');
      if (!response.ok) {
        throw new Error('Failed to get authentication token');
      }

      const { token } = await response.json();

      // Connect to ElevenLabs Scribe v2 Realtime
      const connection = Scribe.connect({
        token,
        modelId: 'scribe_v2_realtime',
        includeTimestamps: false,
        microphone: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      connectionRef.current = connection;

      // Handle session started
      connection.on(RealtimeEvents.SESSION_STARTED, () => {
        console.log('Scribe session started');
        setIsRecording(true);
        setIsProcessing(false);
      });

      // Handle partial transcripts (real-time updates)
      connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, (data: { text: string }) => {
        console.log('Partial:', data.text);
        // Show real-time partial results
        const fullText = transcriptRef.current + (transcriptRef.current ? ' ' : '') + data.text;
        onTranscript(fullText);
      });

      // Handle committed transcripts (finalized segments)
      connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, (data: { text: string }) => {
        console.log('Committed:', data.text);
        // Add to committed transcript
        transcriptRef.current += (transcriptRef.current ? ' ' : '') + data.text;
        // Update with committed text
        onTranscript(transcriptRef.current);
      });

      // Handle errors
      connection.on(RealtimeEvents.ERROR, (errorData: any) => {
        console.error('Scribe error:', errorData);
        setError('Transcription error occurred');
        setIsRecording(false);
        setIsProcessing(false);
      });

      // Handle session ended
      connection.on(RealtimeEvents.SESSION_ENDED, () => {
        console.log('Scribe session ended');
        setIsRecording(false);
        setIsProcessing(false);

        // Send final transcript to parent
        if (transcriptRef.current) {
          onTranscript(transcriptRef.current);
        }
      });

    } catch (err) {
      console.error('Error starting recording:', err);
      setError(err instanceof Error ? err.message : 'Failed to start recording');
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (connectionRef.current) {
      try {
        // Close the connection gracefully
        connectionRef.current.close();
        connectionRef.current = null;

        // Clear states immediately
        setIsRecording(false);
        setIsProcessing(false);
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('Failed to stop recording');
        setIsRecording(false);
        setIsProcessing(false);
      }
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
          {isRecording ? 'Stop recording' : isProcessing ? 'Connecting...' : 'Voice input'}
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
