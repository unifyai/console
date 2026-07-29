'use client';

import * as React from 'react';
import { AudioLines, TriangleAlert } from 'lucide-react';
import { toGsUri } from '@/utils/assistants/callRecording';

/** Played just before a seek target, so the first word is never clipped. */
const SEEK_LEAD_IN_SECONDS = 1;

export interface TranscriptRecordingPlayerHandle {
  /** Move playback to `seconds` and start playing. */
  seek: (seconds: number) => void;
}

interface TranscriptRecordingPlayerProps {
  /** Public GCS URL stored on the exchange. */
  recordingUrl: string;
  /** Playback position, for highlighting the utterance being spoken. */
  onTimeUpdate?: (seconds: number) => void;
}

type Resolution =
  | { state: 'loading' }
  /** The object named by the exchange is not in the bucket. */
  | { state: 'missing' }
  /** Readable transcript, but this caller may not hear the assistant's calls. */
  | { state: 'forbidden' }
  | { state: 'error'; detail: string }
  | { state: 'ready'; url: string };

/**
 * Audio player for a call recording linked to a transcript exchange.
 *
 * Resolves the stored public GCS URL into a signed URL before playing.
 * Orchestra checks the object exists while signing, so a 404 here means the
 * recording genuinely is not in the bucket — which happens for exchanges
 * written before the egress-status gate landed, when a failed egress still
 * published a URL. That case renders as "unavailable" rather than a player
 * that fails on press.
 *
 * Deliberately not `utils/interfaces/selection`'s `AudioPlayer`: that one is
 * built for table cells and carries a module-level signed-URL cache plus an
 * uncleared polling interval, which misbehaves when the reader switches
 * threads quickly.
 */
export const TranscriptRecordingPlayer = React.forwardRef<
  TranscriptRecordingPlayerHandle,
  TranscriptRecordingPlayerProps
>(function TranscriptRecordingPlayer({ recordingUrl, onTimeUpdate }, ref) {
  const [resolution, setResolution] = React.useState<Resolution>({ state: 'loading' });
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  React.useImperativeHandle(
    ref,
    () => ({
      seek: (seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        // Land slightly before the line: starting exactly on the first phoneme
        // clips it, and a moment of lead-in is how transcript players read.
        audio.currentTime = Math.max(0, seconds - SEEK_LEAD_IN_SECONDS);
        void audio.play().catch(() => {
          // Autoplay can be blocked until the user interacts with the page;
          // the seek still landed, so leave the position and stay quiet.
        });
      },
    }),
    []
  );

  React.useEffect(() => {
    const gsUri = toGsUri(recordingUrl);
    if (!gsUri) {
      setResolution({ state: 'error', detail: 'Unrecognised recording location' });
      return;
    }

    const controller = new AbortController();
    setResolution({ state: 'loading' });

    (async () => {
      try {
        const response = await fetch('/api/storage/signed-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // eslint-disable-next-line @typescript-eslint/naming-convention -- API expects snake_case
          body: JSON.stringify({ gs_url: gsUri }),
          signal: controller.signal,
        });
        if (response.status === 404) {
          setResolution({ state: 'missing' });
          return;
        }
        if (response.status === 403) {
          // Don't surface the backend's ownership wording to the reader.
          setResolution({ state: 'forbidden' });
          return;
        }
        if (!response.ok) {
          const body = await response.json().catch(() => null);
          setResolution({
            state: 'error',
            detail: body?.detail ?? `Could not load recording (${response.status})`,
          });
          return;
        }
        const data = await response.json();
        const signed = typeof data?.signed_url === 'string' ? data.signed_url : '';
        setResolution(signed ? { state: 'ready', url: signed } : { state: 'missing' });
      } catch (error) {
        if (controller.signal.aborted) return;
        setResolution({
          state: 'error',
          detail: error instanceof Error ? error.message : 'Could not load recording',
        });
      }
    })();

    return () => controller.abort();
  }, [recordingUrl]);

  const handleTimeUpdate = React.useCallback(
    (event: React.SyntheticEvent<HTMLAudioElement>) => {
      onTimeUpdate?.(event.currentTarget.currentTime);
    },
    [onTimeUpdate]
  );

  if (resolution.state === 'loading') {
    return (
      <Shell>
        <span className="text-caption">Loading recording…</span>
      </Shell>
    );
  }

  if (resolution.state === 'missing') {
    return (
      <Shell muted>
        <span className="text-caption" data-testid="transcript-recording-missing">
          Recording unavailable
        </span>
      </Shell>
    );
  }

  if (resolution.state === 'forbidden') {
    return (
      <Shell muted>
        <span className="text-caption" data-testid="transcript-recording-forbidden">
          No access to this recording
        </span>
      </Shell>
    );
  }

  if (resolution.state === 'error') {
    return (
      <Shell muted>
        <TriangleAlert className="text-error h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="text-caption" data-testid="transcript-recording-error">
          {resolution.detail}
        </span>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- speech is transcribed alongside */}
      <audio
        ref={audioRef}
        controls
        preload="metadata"
        src={resolution.url}
        onTimeUpdate={handleTimeUpdate}
        className="h-8 w-full min-w-0"
        data-testid="transcript-recording-audio"
      />
    </Shell>
  );
});

function Shell({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      className="mb-3 flex min-w-0 items-center gap-2 rounded-[11px] border border-border bg-card-2 px-2.5 py-1.5"
      data-testid="transcript-recording"
    >
      <AudioLines
        className={`h-3.5 w-3.5 shrink-0 ${muted ? 'text-muted-foreground' : 'text-[color:var(--ch)]'}`}
        aria-hidden="true"
      />
      {children}
    </div>
  );
}
