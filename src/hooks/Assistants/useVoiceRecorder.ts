import * as React from 'react';
import recordStartSrc from '@/public/sounds/record-start.mp3';
import recordStopSrc from '@/public/sounds/record-stop.mp3';

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
  const recordStartAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const recordStopAudioRef = React.useRef<HTMLAudioElement | null>(null);

  const playRecordStart = React.useCallback(() => {
    if (!recordStartAudioRef.current) {
      recordStartAudioRef.current = new Audio(recordStartSrc);
      recordStartAudioRef.current.volume = 0.5;
    }
    recordStartAudioRef.current.currentTime = 0;
    recordStartAudioRef.current.play().catch(() => {});
  }, []);

  const playRecordStop = React.useCallback(() => {
    if (!recordStopAudioRef.current) {
      recordStopAudioRef.current = new Audio(recordStopSrc);
      recordStopAudioRef.current.volume = 0.5;
    }
    recordStopAudioRef.current.currentTime = 0;
    recordStopAudioRef.current.play().catch(() => {});
  }, []);

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
      playRecordStart();
    } catch {
      cleanup();
      setError('Microphone access denied');
      setState('idle');
    }
  }, [cleanup, transcribe, playRecordStart]);

  const stopRecording = React.useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      playRecordStop();
    }
  }, [playRecordStop]);

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
    stopRecording,
    isRecording: state === 'recording',
    isTranscribing: state === 'transcribing',
  };
}
