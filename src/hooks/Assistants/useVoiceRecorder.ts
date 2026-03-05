import * as React from 'react';

type RecorderState = 'idle' | 'recording' | 'transcribing';

interface UseVoiceRecorderOptions {
  onTranscript: (text: string) => void;
}

export function useVoiceRecorder({ onTranscript }: UseVoiceRecorderOptions) {
  const [state, setState] = React.useState<RecorderState>('idle');
  const [error, setError] = React.useState<string | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);

  const cleanup = React.useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  React.useEffect(() => cleanup, [cleanup]);

  const transcribe = React.useCallback(
    async (blob: Blob) => {
      setState('transcribing');
      setError(null);
      try {
        const resp = await fetch('/api/assistant/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': blob.type },
          body: blob,
        });
        if (!resp.ok) {
          const data = await resp.json().catch(() => ({}));
          throw new Error(data.error || `Transcription failed (${resp.status})`);
        }
        const { transcript } = await resp.json();
        if (transcript) {
          onTranscript(transcript);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Transcription failed');
      } finally {
        setState('idle');
      }
    },
    [onTranscript]
  );

  const startRecording = React.useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        cleanup();
        if (blob.size > 0) {
          transcribe(blob);
        } else {
          setState('idle');
        }
      };

      recorder.start();
      setState('recording');
    } catch {
      cleanup();
      setError('Microphone access denied');
      setState('idle');
    }
  }, [cleanup, transcribe]);

  const stopRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
  }, []);

  const toggleRecording = React.useCallback(() => {
    if (state === 'recording') {
      stopRecording();
    } else if (state === 'idle') {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  return {
    recorderState: state,
    recorderError: error,
    toggleRecording,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
  };
}
