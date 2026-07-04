'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Mic, Play, Square, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/types/user';
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
  // Resample + downmix via OfflineAudioContext.
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
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
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

async function resolveSignedUrl(gsUrl: string): Promise<string> {
  if (!gsUrl.startsWith('gs://')) return gsUrl;
  const res = await fetch('/api/storage/signed-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
    body: JSON.stringify({ gs_url: gsUrl }),
  });
  if (!res.ok) throw new Error('Failed to resolve voice sample URL');
  const data = await res.json();
  return data.signed_url;
}

type RecordingState = 'idle' | 'recording' | 'preview' | 'uploading';

export function ProfileVoiceSection({ user }: { user: User }) {
  const router = useRouter();
  const [state, setState] = useState<RecordingState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isPlayingSaved, setIsPlayingSaved] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wavBlobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const savedAudioRef = useRef<HTMLAudioElement | null>(null);

  const hasEnrollment = !!user.voiceSample;

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cleanupStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      savedAudioRef.current?.pause();
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
      discardPreview();
      router.refresh();
    } catch (error) {
      console.error('Failed to upload voice sample', error);
      toast.error('Could not save your voice sample. Please try again.');
      setState('preview');
    }
  }, [discardPreview, elapsed, router]);

  const removeEnrollment = useCallback(async () => {
    if (isRemoving) return;
    setIsRemoving(true);
    try {
      const response = await fetch('/api/user/voice', { method: 'DELETE' });
      if (!response.ok) {
        toast.error('Could not remove your voice sample. Please try again.');
        return;
      }
      toast.success('Voice sample removed.');
      router.refresh();
    } catch (error) {
      console.error('Failed to remove voice sample', error);
      toast.error('Could not remove your voice sample. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  }, [isRemoving, router]);

  const playSaved = useCallback(async () => {
    if (!user.voiceSample) return;
    if (isPlayingSaved) {
      savedAudioRef.current?.pause();
      setIsPlayingSaved(false);
      return;
    }
    try {
      const url = await resolveSignedUrl(user.voiceSample);
      const audio = new Audio(url);
      savedAudioRef.current = audio;
      audio.onended = () => setIsPlayingSaved(false);
      setIsPlayingSaved(true);
      await audio.play();
    } catch (error) {
      console.error('Failed to play voice sample', error);
      setIsPlayingSaved(false);
      toast.error('Could not play your voice sample.');
    }
  }, [isPlayingSaved, user.voiceSample]);

  const enrolledAt = user.voiceSampleUploadedAt
    ? new Date(user.voiceSampleUploadedAt).toLocaleDateString()
    : null;

  const showRecorder = state !== 'idle' || !hasEnrollment;

  return (
    <div className="mt-8 max-w-2xl">
      <h3 className="text-title">Voice</h3>
      <p className="text-body-muted mt-1">
        Record a short voice sample (~20 seconds) so your assistant can recognize your voice on
        calls and tell you apart from other people in the room.
      </p>

      {hasEnrollment && state === 'idle' && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border p-3">
          <div className="min-w-0 flex-1">
            <p className="text-title">Voice enrolled</p>
            {enrolledAt && <p className="text-caption">Recorded {enrolledAt}</p>}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void playSaved()}>
            {isPlayingSaved ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {isPlayingSaved ? 'Stop' : 'Play'}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void startRecording()}>
            <Mic className="h-4 w-4" />
            Re-record
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRemoving}
            onClick={() => void removeEnrollment()}
            className="text-destructive hover:text-destructive"
          >
            {isRemoving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Remove
          </Button>
        </div>
      )}

      {showRecorder && (
        <div className="mt-4 rounded-lg border border-border p-4">
          <p className="text-title">Read this passage aloud at a natural pace:</p>
          <blockquote className="mt-2 max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-sm leading-relaxed text-muted-foreground">
            {ENROLLMENT_PASSAGE}
          </blockquote>

          <div className="mt-4 flex items-center gap-3">
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
        </div>
      )}
    </div>
  );
}
