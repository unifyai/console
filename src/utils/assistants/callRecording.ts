/**
 * Helpers for surfacing a call recording alongside its transcript.
 *
 * The runtime stores the recording on the exchange, and per-utterance offsets
 * on each message. Both arrive through the logs proxy, which rewrites *every*
 * key it sees — including keys inside free-form metadata — so the accessors
 * here read both casings rather than trusting one.
 */

/** Public GCS URL -> `gs://` URI, which is what the signed-URL API accepts. */
export function toGsUri(publicUrl: string): string | null {
  const trimmed = publicUrl.trim();
  if (trimmed.startsWith('gs://')) return trimmed;
  try {
    const url = new URL(trimmed);
    if (url.hostname !== 'storage.googleapis.com') return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    const [bucket, ...objectPath] = parts;
    return `gs://${bucket}/${objectPath.map(decodeURIComponent).join('/')}`;
  } catch {
    return null;
  }
}

/** Read one metadata value under either the stored or the proxied key name.
 *
 * Orchestra stores `recording_url`; `snakeToCamelObject` in the logs proxy
 * recurses into metadata and delivers `recordingUrl`. Accepting both means a
 * change to the proxy cannot silently blank the player.
 */
function readMetadata(
  metadata: Record<string, unknown> | null | undefined,
  snakeKey: string
): string | null {
  if (!metadata) return null;
  const camelKey = snakeKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  for (const key of [camelKey, snakeKey]) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function recordingUrlFrom(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  return readMetadata(metadata, 'recording_url');
}

/** Epoch ms at which the recording's audio begins, if the exchange records it. */
export function recordingStartedAtFrom(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  const raw = readMetadata(metadata, 'recording_started_at');
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Seconds into the recording at which a message was spoken.
 *
 * Preferred over the stored `MM.SS` stamp because it is measured against the
 * audio itself. The stored stamp is anchored to the call-started event, which
 * fires a few seconds before the egress compositor starts writing, so it sits
 * ahead of the audio by that much. Returns null when the exchange predates the
 * recording anchor, leaving the caller to fall back to the stored stamp.
 */
export function offsetFromRecordingStart(
  messageTimestamp: string | Date | null | undefined,
  recordingStartedAtMs: number | null
): number | null {
  if (!messageTimestamp || recordingStartedAtMs === null) return null;
  const spokenAt =
    messageTimestamp instanceof Date ? messageTimestamp.getTime() : Date.parse(messageTimestamp);
  if (Number.isNaN(spokenAt)) return null;
  const seconds = (spokenAt - recordingStartedAtMs) / 1000;
  // Messages logged before the compositor attached (a dial notice, say) have no
  // position in the file.
  return seconds < 0 ? null : seconds;
}

/** A call's stored recording, as the UI needs it. */
export interface CallRecording {
  url: string;
  /** Epoch ms of the audio's t=0, when the exchange carries the anchor. */
  startedAtMs: number | null;
}

/** What a call pill can reach once its exchange is resolved. */
export interface CallTarget {
  /** Identifies the thread in the transcripts pane, together with `rootKey`. */
  exchangeId: number | null;
  /** Source root the exchange was read from; exchange ids are root-local. */
  rootKey: string;
  /** Null for a call that was never recorded, or whose egress produced nothing. */
  recording: CallRecording | null;
}

/** Metadata keys a call's identifier can be stored under, most specific first. */
const CALL_IDENTIFIER_KEYS = [
  'recording_call_session_id',
  'call_session_id',
  'recording_room_name',
  'room_name',
  'conference_name',
] as const;

/**
 * Index an assistant's exchanges by every identifier a call is known by.
 *
 * The transcripts pane joins exchanges to messages on `exchangeId`, but a call
 * pill only knows its call-store id -- a call-session id for meets, a room name
 * for the older phone/WhatsApp rows. Those are exactly the identifiers the
 * runtime persists onto the exchange, so indexing by all of them lets a pill
 * resolve both its recording and its thread in the pane.
 *
 * Unrecorded calls are indexed too: a pill can still jump to its transcript
 * thread when there is no audio to play.
 */
export function callTargetsByCallId(
  exchanges: ReadonlyArray<{
    exchangeId?: number | null;
    rootKey?: string;
    metadata?: Record<string, unknown> | null;
  }>
): Map<string, CallTarget> {
  const byCallId = new Map<string, CallTarget>();
  for (const exchange of exchanges) {
    const url = recordingUrlFrom(exchange.metadata);
    const target: CallTarget = {
      exchangeId: exchange.exchangeId ?? null,
      rootKey: exchange.rootKey ?? 'personal',
      recording: url ? { url, startedAtMs: recordingStartedAtFrom(exchange.metadata) } : null,
    };
    for (const key of CALL_IDENTIFIER_KEYS) {
      const identifier = readMetadata(exchange.metadata, key);
      // First exchange to claim an identifier wins; reads are newest-first, so
      // a reused room name resolves to its most recent call.
      if (identifier && !byCallId.has(identifier)) byCallId.set(identifier, target);
    }
  }
  return byCallId;
}

/** True when the exchange looks like a call, recorded or not.
 *
 * Distinguishes "no recording for this call" from "not a call", which is the
 * difference between a useful empty state and pointless UI noise. */
export function isCallExchange(metadata: Record<string, unknown> | null | undefined): boolean {
  return (
    readMetadata(metadata, 'room_name') !== null ||
    readMetadata(metadata, 'conference_name') !== null ||
    readMetadata(metadata, 'call_session_id') !== null ||
    readMetadata(metadata, 'recording_room_name') !== null
  );
}

/** `MM.SS` offset from call start -> seconds. Minutes are unbounded (`72.05`). */
export function parseUtteranceOffset(
  metadata: Record<string, unknown> | null | undefined
): number | null {
  const raw = readMetadata(metadata, 'call_utterance_timestamp');
  if (!raw) return null;
  const match = raw.match(/^(\d+)[.:](\d{1,2})$/);
  if (!match) return null;
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds) || seconds >= 60) return null;
  return minutes * 60 + seconds;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export interface UtteranceCue {
  messageId: number;
  offsetSeconds: number;
}

/**
 * Which utterance is playing at `currentTime`, as an index into `cues`.
 *
 * Assistant offsets carry a ~2s TTS-playback allowance, so offsets are
 * approximate and *not* monotonic in message order — a reply can be stamped
 * earlier than the question it answers. Sorting by offset here keeps the
 * highlight moving forward even when the transcript order disagrees.
 */
export function activeCueMessageId(cues: UtteranceCue[], currentTime: number): number | null {
  let activeId: number | null = null;
  let bestOffset = -1;
  for (const cue of cues) {
    if (cue.offsetSeconds <= currentTime && cue.offsetSeconds >= bestOffset) {
      bestOffset = cue.offsetSeconds;
      activeId = cue.messageId;
    }
  }
  return activeId;
}
