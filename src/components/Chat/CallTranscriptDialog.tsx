import * as React from 'react';
import { ExternalLink, MessageSquare, Phone, Play } from 'lucide-react';
import { Loader } from '@/components/Common/Loader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/dialog';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CallPill, CallTranscriptUtterance } from '@/types/assistants/chat';
import { cn } from '@/lib/utils';
import {
  activeCueMessageId,
  formatClock,
  offsetFromRecordingStart,
  parseUtteranceOffset,
  type UtteranceCue,
} from '@/utils/assistants/callRecording';
import {
  TranscriptRecordingPlayer,
  type TranscriptRecordingPlayerHandle,
} from '@/components/Pages/Assistants/Transcripts/TranscriptRecordingPlayer';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `0:${String(seconds).padStart(2, '0')}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

/** Seconds into the recording for one utterance.
 *
 *  Prefers the recording anchor, which is measured against the audio itself.
 *  Falls back to the stored `MM.SS` stamp for calls recorded before the anchor
 *  existed -- those read a few seconds ahead of their audio. */
function utteranceOffset(
  utterance: CallTranscriptUtterance,
  recordingStartedAtMs: number | null
): number | null {
  return (
    offsetFromRecordingStart(
      // The audible start when the runtime observed one; `timestamp` is the
      // commit that follows the line and so sits past it in the audio.
      utterance.speechStartedAt ?? utterance.timestamp,
      recordingStartedAtMs
    ) ??
    // eslint-disable-next-line @typescript-eslint/naming-convention -- stored key shape
    parseUtteranceOffset({ call_utterance_timestamp: utterance.callUtteranceTimestamp })
  );
}

interface CallTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pill: CallPill | null;
  utterances: CallTranscriptUtterance[];
  loading: boolean;
  assistantName?: string;
  /** Opens this call's thread in the Transcripts pane. Omitted when the thread
   *  could not be resolved, which hides the affordance rather than dead-ending. */
  onOpenInTranscripts?: () => void;
}

export function CallTranscriptDialog({
  open,
  onOpenChange,
  pill,
  utterances,
  loading,
  assistantName = 'Assistant',
  onOpenInTranscripts,
}: CallTranscriptDialogProps) {
  const playerRef = React.useRef<TranscriptRecordingPlayerHandle | null>(null);
  const [playheadSeconds, setPlayheadSeconds] = React.useState<number | null>(null);

  const recordingUrl = pill?.recordingUrl ?? null;
  const recordingStartedAtMs = pill?.recordingStartedAtMs ?? null;

  // Reset between calls so a stale highlight cannot carry into the next pill.
  React.useEffect(() => {
    setPlayheadSeconds(null);
  }, [pill?.id, open]);

  // The call store returns utterances in id order, which drifts from speech
  // order once one is logged out of sequence. Ordering by when it was spoken
  // keeps the transcript readable and the highlight moving forward.
  const ordered = React.useMemo(
    () => [...utterances].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()),
    [utterances]
  );

  const cues = React.useMemo<UtteranceCue[]>(() => {
    const built: UtteranceCue[] = [];
    ordered.forEach((utterance, index) => {
      // Chat lines sit in the timeline but were never spoken, so they must not
      // become cues: the playhead would highlight one while the audio plays
      // whatever was actually being said at that moment.
      if (utterance.isChat) return;
      const offsetSeconds = utteranceOffset(utterance, recordingStartedAtMs);
      // `UtteranceCue` keys on a numeric id; call-store ids are strings, so the
      // index into `ordered` stands in for one.
      if (offsetSeconds !== null) built.push({ messageId: index, offsetSeconds });
    });
    return built;
  }, [ordered, recordingStartedAtMs]);

  const activeIndex = React.useMemo(() => {
    if (playheadSeconds === null || cues.length === 0) return null;
    return activeCueMessageId(cues, playheadSeconds);
  }, [cues, playheadSeconds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] flex-col sm:max-w-[500px]"
        data-testid="call-transcript-dialog"
      >
        {/* Sits immediately left of DialogContent's own close button, which is
            absolutely positioned at right-4 top-4. */}
        {onOpenInTranscripts && (
          <button
            type="button"
            onClick={onOpenInTranscripts}
            aria-label="Open in Transcripts"
            title="Open in Transcripts"
            data-testid="call-transcript-open-in-transcripts"
            className="absolute right-11 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            <ExternalLink className="h-4 w-4" />
          </button>
        )}

        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call Transcript
          </DialogTitle>
          {/* With a recording present the player's own duration is
              authoritative, so the pill's client-measured duration is dropped
              rather than shown next to a number that disagrees with it. */}
          {pill && !recordingUrl && (
            <DialogDescription>Duration: {formatDuration(pill.durationSeconds)}</DialogDescription>
          )}
        </DialogHeader>

        {recordingUrl && (
          <TranscriptRecordingPlayer
            key={pill?.id ?? 'recording'}
            ref={playerRef}
            recordingUrl={recordingUrl}
            onTimeUpdate={setPlayheadSeconds}
          />
        )}

        <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader size={20} />
            </div>
          ) : ordered.length === 0 ? (
            <div className="text-caption py-12 text-center text-muted-foreground">
              No transcript available for this call.
            </div>
          ) : (
            <div className="space-y-3 pr-4" data-testid="call-transcript-content">
              {ordered.map((utterance, index) => {
                const offsetSeconds = utteranceOffset(utterance, recordingStartedAtMs);
                const isPlaying = activeIndex === index;
                return (
                  <div
                    key={utterance.id}
                    data-testid="call-transcript-utterance"
                    data-playing={isPlaying ? 'true' : undefined}
                    className={cn(
                      'rounded-lg px-2 py-1 transition-colors',
                      isPlaying && 'bg-primary/10 ring-1 ring-primary'
                    )}
                  >
                    <div className="flex items-baseline gap-2">
                      {utterance.isChat && (
                        <MessageSquare
                          className="h-3 w-3 shrink-0 self-center text-muted-foreground"
                          aria-label="Sent in the meeting chat"
                          data-testid="call-transcript-chat-icon"
                        />
                      )}
                      <span
                        className={cn(
                          'text-xs font-semibold',
                          utterance.role === 'assistant'
                            ? 'text-muted-foreground'
                            : 'text-foreground'
                        )}
                      >
                        {utterance.role === 'assistant' ? assistantName : 'You'}
                      </span>
                      {offsetSeconds !== null &&
                        // A typed line has no audio to seek to, so its position
                        // is shown but not made playable.
                        (recordingUrl && !utterance.isChat ? (
                          <button
                            type="button"
                            onClick={() => playerRef.current?.seek(offsetSeconds)}
                            aria-label={`Play recording from ${formatClock(offsetSeconds)}`}
                            title="Play from here"
                            data-testid="call-transcript-seek-button"
                            className="inline-flex items-center gap-1 rounded px-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-primary"
                          >
                            <Play className="h-2.5 w-2.5" aria-hidden="true" />
                            {formatClock(offsetSeconds)}
                          </button>
                        ) : (
                          <span className="text-muted-foreground/60 font-mono text-[10px]">
                            {formatClock(offsetSeconds)}
                          </span>
                        ))}
                    </div>
                    <p className="text-sm leading-relaxed">{utterance.content}</p>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
