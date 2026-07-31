import { describe, expect, it } from 'vitest';
import {
  activeCueMessageId,
  formatClock,
  isCallExchange,
  isChatFrom,
  offsetFromRecordingStart,
  parseUtteranceOffset,
  recordingStartedAtFrom,
  callTargetsByCallId,
  recordingUrlFrom,
  speechStartedAtFrom,
  toGsUri,
  type UtteranceCue,
} from './callRecording';

describe('toGsUri', () => {
  it('converts the public GCS URL the runtime stores', () => {
    expect(
      toGsUri(
        'https://storage.googleapis.com/unity-call-recordings/staging/2105/unity_2105_phone.mp3'
      )
    ).toBe('gs://bucket/staging/2105/unity_2105_phone.mp3');
  });

  it('passes a gs:// URI through unchanged', () => {
    expect(toGsUri('gs://bucket/a/b.mp3')).toBe('gs://bucket/a/b.mp3');
  });

  it('decodes percent-encoded object paths', () => {
    expect(toGsUri('https://storage.googleapis.com/b/a%20b.mp3')).toBe('gs://bucket/a b.mp3');
  });

  it('rejects hosts that are not GCS, so nothing else can be signed through us', () => {
    expect(toGsUri('https://evil.example.com/bucket/x.mp3')).toBeNull();
  });

  it('rejects a bucket with no object path', () => {
    expect(toGsUri('https://storage.googleapis.com/bucket-only')).toBeNull();
  });

  it('rejects unparseable input', () => {
    expect(toGsUri('not a url')).toBeNull();
  });
});

describe('recordingUrlFrom', () => {
  // The logs proxy runs snakeToCamelObject over the whole response and recurses
  // into metadata, so the stored key never survives the trip. Both must work.
  it('reads the camelCase key the logs proxy delivers', () => {
    expect(recordingUrlFrom({ recordingUrl: 'https://x/y.mp3' })).toBe('https://x/y.mp3');
  });

  it('reads the snake_case key Orchestra stores', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors stored shape
    expect(recordingUrlFrom({ recording_url: 'https://x/y.mp3' })).toBe('https://x/y.mp3');
  });

  it('ignores blank and non-string values', () => {
    expect(recordingUrlFrom({ recordingUrl: '   ' })).toBeNull();
    expect(recordingUrlFrom({ recordingUrl: 42 })).toBeNull();
    expect(recordingUrlFrom(null)).toBeNull();
    expect(recordingUrlFrom({})).toBeNull();
  });
});

describe('isCallExchange', () => {
  it('recognises a meet by its session id', () => {
    expect(isCallExchange({ callSessionId: '48dcf6b4' })).toBe(true);
  });

  it('recognises a phone call by its conference name', () => {
    expect(isCallExchange({ conferenceName: 'Unity_conf_1' })).toBe(true);
  });

  it('recognises a pre-fix exchange that kept only recording_room_name', () => {
    // Writes before the metadata-merge fix clobbered room_name, leaving only
    // the key RecordingReady itself wrote.
    expect(isCallExchange({ recordingRoomName: 'unity_2105_gmeet' })).toBe(true);
  });

  it('does not treat an email or chat exchange as a call', () => {
    expect(isCallExchange({ emailThreadId: 'abc' })).toBe(false);
    expect(isCallExchange(null)).toBe(false);
  });
});

describe('parseUtteranceOffset', () => {
  it('parses the MM.SS offset the runtime stamps', () => {
    expect(parseUtteranceOffset({ callUtteranceTimestamp: '00.34' })).toBe(34);
    expect(parseUtteranceOffset({ callUtteranceTimestamp: '02.15' })).toBe(135);
  });

  it('handles minutes past an hour, which are not zero-padded to two digits', () => {
    expect(parseUtteranceOffset({ callUtteranceTimestamp: '72.05' })).toBe(4325);
  });

  it('rejects malformed or out-of-range values rather than guessing', () => {
    expect(parseUtteranceOffset({ callUtteranceTimestamp: '00.99' })).toBeNull();
    expect(parseUtteranceOffset({ callUtteranceTimestamp: 'abc' })).toBeNull();
    expect(parseUtteranceOffset({ callUtteranceTimestamp: '' })).toBeNull();
    expect(parseUtteranceOffset({})).toBeNull();
  });
});

describe('formatClock', () => {
  it('formats as m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(34)).toBe('0:34');
    expect(formatClock(135)).toBe('2:15');
    expect(formatClock(4325)).toBe('72:05');
  });

  it('clamps negatives', () => {
    expect(formatClock(-5)).toBe('0:00');
  });
});

describe('activeCueMessageId', () => {
  // Assistant utterances carry a ~2s TTS allowance, so offsets are approximate
  // and can invert relative to message order. Observed live: mid 499 at 00.23
  // precedes mid 500 at 00.22 in the transcript.
  const cues: UtteranceCue[] = [
    { messageId: 499, offsetSeconds: 23 },
    { messageId: 500, offsetSeconds: 22 },
    { messageId: 501, offsetSeconds: 25 },
    { messageId: 502, offsetSeconds: 24 },
    { messageId: 505, offsetSeconds: 34 },
  ];

  it('returns nothing before the first utterance', () => {
    expect(activeCueMessageId(cues, 0)).toBeNull();
    expect(activeCueMessageId(cues, 21.9)).toBeNull();
  });

  it('picks by offset, not transcript order, when the two disagree', () => {
    // At 23s the latest-started utterance is 499 (23s), not 500 (22s), even
    // though 500 comes later in the thread.
    expect(activeCueMessageId(cues, 23)).toBe(499);
    expect(activeCueMessageId(cues, 22.5)).toBe(500);
  });

  it('advances as playback proceeds', () => {
    expect(activeCueMessageId(cues, 24.5)).toBe(502);
    expect(activeCueMessageId(cues, 25)).toBe(501);
  });

  it('holds the last utterance through trailing audio', () => {
    expect(activeCueMessageId(cues, 81)).toBe(505);
  });

  it('returns nothing when the thread has no cues', () => {
    expect(activeCueMessageId([], 10)).toBeNull();
  });
});

describe('recordingStartedAtFrom', () => {
  it('reads the anchor under either key casing', () => {
    expect(recordingStartedAtFrom({ recordingStartedAt: '2026-07-27T12:48:26+00:00' })).toBe(
      Date.parse('2026-07-27T12:48:26Z')
    );
    expect(
      // eslint-disable-next-line @typescript-eslint/naming-convention -- mirrors stored shape
      recordingStartedAtFrom({ recording_started_at: '2026-07-27T12:48:26+00:00' })
    ).toBe(Date.parse('2026-07-27T12:48:26Z'));
  });

  it('returns null when absent or unparseable', () => {
    expect(recordingStartedAtFrom({})).toBeNull();
    expect(recordingStartedAtFrom({ recordingStartedAt: 'not a date' })).toBeNull();
    expect(recordingStartedAtFrom(null)).toBeNull();
  });
});

describe('offsetFromRecordingStart', () => {
  // Real staging data: exchange 378 (Unify Meet). Egress began writing at
  // 12:48:26; the stored MM.SS stamps read 20s ahead of the audio because they
  // were anchored to the call-started event and read at logging time.
  const anchor = Date.parse('2026-07-27T12:48:26Z');

  it('measures against the audio, not the call event', () => {
    expect(offsetFromRecordingStart('2026-07-27T12:48:28+00:00', anchor)).toBe(2);
    expect(offsetFromRecordingStart('2026-07-27T12:48:57+00:00', anchor)).toBe(31);
  });

  it('is monotonic in speech order, unlike the stored stamps', () => {
    const walls = [
      '2026-07-27T12:48:28+00:00',
      '2026-07-27T12:48:32+00:00',
      '2026-07-27T12:48:38+00:00',
      '2026-07-27T12:48:43+00:00',
    ];
    const offsets = walls.map((w) => offsetFromRecordingStart(w, anchor));
    expect(offsets).toEqual([2, 6, 12, 17]);
    // The stored stamps for these same four were 23, 22, 25, 24 — inverted.
    const sorted = [...offsets].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(offsets).toEqual(sorted);
  });

  it('returns null for a message logged before the compositor attached', () => {
    // Exchange 379's "<Sending Call...>" sat 3s before its recording began.
    expect(offsetFromRecordingStart('2026-07-27T12:48:23+00:00', anchor)).toBeNull();
  });

  it('returns null without an anchor, so callers fall back to the stored stamp', () => {
    expect(offsetFromRecordingStart('2026-07-27T12:48:28+00:00', null)).toBeNull();
    expect(offsetFromRecordingStart(null, anchor)).toBeNull();
  });
});

describe('callTargetsByCallId', () => {
  // A pill knows a call-store id, not an exchange id, so the index has to cover
  // every identifier the runtime persists next to the recording.
  const meet = {
    metadata: {
      medium: 'unify_meet',
      recordingUrl: 'https://x/meet.mp3',
      recordingStartedAt: '2026-07-27T12:48:26+00:00',
      callSessionId: '48dcf6b4',
      recordingCallSessionId: '48dcf6b4',
      roomName: 'unity_call_48dcf6b4',
      recordingRoomName: 'unity_call_48dcf6b4',
    },
  };
  const phone = {
    metadata: {
      medium: 'phone_call',
      recordingUrl: 'https://x/phone.mp3',
      recordingStartedAt: '2026-07-27T15:11:35+00:00',
      roomName: 'unity_2105_phone',
      recordingRoomName: 'unity_2105_phone',
      providerCallSid: 'CA111',
    },
  };

  it('resolves a meet by its call-session id', () => {
    const index = callTargetsByCallId([meet]);
    expect(index.get('48dcf6b4')?.recording).toEqual({
      url: 'https://x/meet.mp3',
      startedAtMs: Date.parse('2026-07-27T12:48:26Z'),
    });
  });

  it('resolves a phone call by its room name', () => {
    const index = callTargetsByCallId([phone]);
    expect(index.get('unity_2105_phone')?.recording?.url).toBe('https://x/phone.mp3');
  });

  it('indexes one recording under every identifier it carries', () => {
    const index = callTargetsByCallId([meet]);
    for (const id of ['48dcf6b4', 'unity_call_48dcf6b4']) {
      expect(index.get(id)?.recording?.url).toBe('https://x/meet.mp3');
    }
  });

  it('indexes an unrecorded call so its thread is still reachable', () => {
    // The redirect to the transcripts pane must work whether or not audio was
    // captured, so a missing recording cannot drop the exchange from the index.
    const index = callTargetsByCallId([
      { exchangeId: 12, rootKey: 'personal', metadata: { callSessionId: 'no-recording' } },
    ]);
    expect(index.get('no-recording')).toEqual({
      exchangeId: 12,
      rootKey: 'personal',
      recording: null,
    });
  });

  it('ignores exchanges carrying no identifiers at all', () => {
    expect(callTargetsByCallId([{ metadata: null }, {}]).size).toBe(0);
  });

  it('carries the exchange id and root so the pane can select the thread', () => {
    const index = callTargetsByCallId([
      { exchangeId: 378, rootKey: 'team-11', metadata: { callSessionId: '48dcf6b4' } },
    ]);
    expect(index.get('48dcf6b4')?.exchangeId).toBe(378);
    expect(index.get('48dcf6b4')?.rootKey).toBe('team-11');
  });

  it('defaults the root to personal when a row is untagged', () => {
    const index = callTargetsByCallId([{ exchangeId: 1, metadata: { callSessionId: 'x' } }]);
    expect(index.get('x')?.rootKey).toBe('personal');
  });

  it('keeps the newest claim when a room name is reused across calls', () => {
    // Reads are newest-first, so the first exchange to claim an identifier is
    // the most recent call in that room.
    const index = callTargetsByCallId([
      { metadata: { recordingUrl: 'https://x/newest.mp3', roomName: 'unity_2105_phone' } },
      { metadata: { recordingUrl: 'https://x/older.mp3', roomName: 'unity_2105_phone' } },
    ]);
    expect(index.get('unity_2105_phone')?.recording?.url).toBe('https://x/newest.mp3');
  });

  it('carries a null anchor for recordings that predate it', () => {
    const index = callTargetsByCallId([
      { metadata: { recordingUrl: 'https://x/old.mp3', roomName: 'unity_2105_gmeet' } },
    ]);
    expect(index.get('unity_2105_gmeet')?.recording).toEqual({
      url: 'https://x/old.mp3',
      startedAtMs: null,
    });
  });
});

describe('offsetFromRecordingStart with Date input', () => {
  // The call-pill dialog holds spoken_at as a Date, the pane holds an ISO string.
  it('accepts either', () => {
    const anchor = Date.parse('2026-07-27T12:48:26Z');
    expect(offsetFromRecordingStart(new Date('2026-07-27T12:48:28Z'), anchor)).toBe(2);
    expect(offsetFromRecordingStart('2026-07-27T12:48:28+00:00', anchor)).toBe(2);
  });

  it('rejects an invalid Date', () => {
    expect(offsetFromRecordingStart(new Date('nope'), 0)).toBeNull();
  });
});

describe('speechStartedAtFrom', () => {
  // The runtime stamps a line's audible start separately from the commit that
  // follows it. The two surfaces receive it under different casings: the logs
  // proxy camelises metadata, the calls API does not.
  it('reads the camelCase key the logs proxy delivers', () => {
    expect(speechStartedAtFrom({ speechStartedAt: '2026-07-29T10:00:05+00:00' })).toBe(
      '2026-07-29T10:00:05+00:00'
    );
  });

  it('reads the snake_case key the calls API delivers', () => {
    // eslint-disable-next-line @typescript-eslint/naming-convention -- stored shape
    expect(speechStartedAtFrom({ speech_started_at: '2026-07-29T10:00:05+00:00' })).toBe(
      '2026-07-29T10:00:05+00:00'
    );
  });

  it('returns null when the runtime observed no start', () => {
    expect(speechStartedAtFrom({})).toBeNull();
    expect(speechStartedAtFrom(null)).toBeNull();
    expect(speechStartedAtFrom({ speechStartedAt: '  ' })).toBeNull();
  });
});

describe('offset preference: speech start over commit', () => {
  const anchor = Date.parse('2026-07-29T10:00:00Z');

  it('places a line where it began, not where it was committed', () => {
    // Spoken at +5s, committed at +8s once STT finalised.
    const speechStart = '2026-07-29T10:00:05+00:00';
    const committed = '2026-07-29T10:00:08+00:00';

    expect(offsetFromRecordingStart(speechStart, anchor)).toBe(5);
    // What the UI would have shown before the start was carried.
    expect(offsetFromRecordingStart(committed, anchor)).toBe(8);
  });

  it('falls back to the commit when no start was observed', () => {
    const metadata = {};
    const committed = '2026-07-29T10:00:08+00:00';
    expect(offsetFromRecordingStart(speechStartedAtFrom(metadata) ?? committed, anchor)).toBe(8);
  });
});

describe('isChatFrom', () => {
  // Both transcript renderers gate the seek control and their playback cues on
  // this, so a false negative reintroduces a play button that seeks to audio the
  // row was never part of.
  it('recognises a typed line under either casing', () => {
    expect(isChatFrom({ kind: 'chat' })).toBe(true);
  });

  it('treats a spoken line as not chat', () => {
    expect(isChatFrom({})).toBe(false);
    expect(isChatFrom(null)).toBe(false);
    expect(isChatFrom(undefined)).toBe(false);
  });

  it('does not mistake another kind for chat', () => {
    // `kind` is a general tag; only the chat value may suppress playback.
    expect(isChatFrom({ kind: 'speech' })).toBe(false);
    expect(isChatFrom({ kind: '' })).toBe(false);
  });
});
