'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic, Square, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Button } from '@/components/UI/button';

/**
 * Fixed enrollment passage so users never have to decide what to say. Reading
 * it at a natural pace gives the speaker-embedding model enough phonetic
 * variety for reliable voice recognition.
 */
const ENROLLMENT_PASSAGE = `I've seen things you people wouldn't believe. Attack ships on fire off the shoulder of Orion. I watched C-beams glitter in the dark near the Tannhäuser Gate. All those moments will be lost in time, like tears in rain.`;

const TARGET_SECONDS = 20;
const MAX_SECONDS = 30;
const MIN_SECONDS = 10;
const WAV_SAMPLE_RATE = 16000;

/** Encode an AudioBuffer as a 16 kHz mono 16-bit PCM WAV blob. */
async function audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
  const duration = buffer.duration;
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(duration * WAV_SAMPLE_RATE),
    WAV_SAMPLE_RATE
  );
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.connect(offline.destination);
  source.start();
  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);

  const dataLength = samples.length * 2;
  const arrayBuffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WAV_SAMPLE_RATE, true);
  view.setUint32(28, WAV_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const ctx = new AudioContext();
  try {
    const decoded = await ctx.decodeAudioData(arrayBuffer);
    return await audioBufferToWav(decoded);
  } finally {
    void ctx.close();
  }
}

type RecordingState = 'idle' | 'recording' | 'preview' | 'uploading';

interface VoiceEnrollmentFallbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled?: () => void;
}

export function VoiceEnrollmentFallbackDialog({
  open,
  onOpenChange,
  onEnrolled,
}: VoiceEnrollmentFallbackDialogProps) {
  const router = useRouter();
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wavBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resetRecording = useCallback(() => {
    cleanupStream();
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    wavBlobRef.current = null;
    chunksRef.current = [];
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setElapsed(0);
    setState('idle');
  }, [cleanupStream]);

  useEffect(() => {
    if (open) return;
    resetRecording();
  }, [open, resetRecording]);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unmount only
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        cleanupStream();
        const raw = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (raw.size === 0) {
          setState('idle');
          return;
        }
        try {
          const wav = await blobToWav(raw);
          wavBlobRef.current = wav;
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(wav);
          });
          setState('preview');
        } catch (error) {
          console.error('Failed to encode recording', error);
          toast.error('Could not process the recording. Please try again.');
          setState('idle');
        }
      };

      setElapsed(0);
      setState('recording');
      recorder.start();

      const startedAt = Date.now();
      timerRef.current = setInterval(() => {
        const seconds = Math.floor((Date.now() - startedAt) / 1000);
        setElapsed(seconds);
        if (seconds >= MAX_SECONDS) {
          stopRecording();
        }
      }, 250);
    } catch (error) {
      console.error('Microphone access failed', error);
      toast.error('Could not access your microphone. Check browser permissions.');
      setState('idle');
    }
  }, [cleanupStream, stopRecording]);

  const discardPreview = useCallback(() => {
    wavBlobRef.current = null;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setElapsed(0);
    setState('idle');
  }, []);

  const uploadRecording = useCallback(async () => {
    const wav = wavBlobRef.current;
    if (!wav) return;
    if (elapsed < MIN_SECONDS) {
      toast.error(`Recording is too short — read the passage for at least ${MIN_SECONDS} seconds.`);
      return;
    }
    setState('uploading');
    try {
      const formData = new FormData();
      formData.append(
        'file',
        new File([wav], `voice-enrollment-${Date.now()}.wav`, { type: 'audio/wav' })
      );
      const response = await fetch('/api/user/voice/upload', {
        method: 'POST',
        body: formData,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.detail || 'Could not save your voice sample. Please try again.');
        setState('preview');
        return;
      }
      toast.success('Voice enrolled. Your assistant can now verify your voice on calls.');
      onOpenChange(false);
      onEnrolled?.();
      router.refresh();
    } catch (error) {
      console.error('Failed to upload voice sample', error);
      toast.error('Could not save your voice sample. Please try again.');
      setState('preview');
    }
  }, [elapsed, onEnrolled, onOpenChange, router]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && (state === 'recording' || state === 'uploading')) return;
      onOpenChange(nextOpen);
    },
    [onOpenChange, state]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" data-testid="voice-enrollment-fallback-dialog">
        <DialogHeader>
          <DialogTitle>Record your voice</DialogTitle>
          <DialogDescription>
            We couldn&apos;t capture a clear voice sample from your call — background noise or other
            voices interrupted the recording. Read this short passage (~20 seconds) so your
            assistant can recognize you on future calls.
          </DialogDescription>
        </DialogHeader>

        <blockquote className="max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
          {ENROLLMENT_PASSAGE}
        </blockquote>

        <div className="flex flex-wrap items-center gap-3">
          {state === 'idle' && (
            <Button type="button" onClick={() => void startRecording()}>
              <Mic className="h-4 w-4" />
              Start recording
            </Button>
          )}

          {state === 'recording' && (
            <>
              <Button type="button" variant="destructive" onClick={stopRecording}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
              <span className="text-sm tabular-nums text-muted-foreground">
                {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')} /{' '}
                {Math.floor(TARGET_SECONDS / 60)}:{String(TARGET_SECONDS % 60).padStart(2, '0')}
              </span>
              <span className="text-body text-error flex items-center gap-1.5">
                <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                Recording
              </span>
            </>
          )}

          {(state === 'preview' || state === 'uploading') && (
            <>
              {previewUrl && <audio controls src={previewUrl} className="h-9 max-w-64" />}
              <Button
                type="button"
                disabled={state === 'uploading'}
                onClick={() => void uploadRecording()}
              >
                {state === 'uploading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Save
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={state === 'uploading'}
                onClick={discardPreview}
              >
                Discard
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
