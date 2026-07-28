import { describe, expect, it } from 'vitest';
import {
  activeCueMessageId,
  formatClock,
  isCallExchange,
  offsetFromRecordingStart,
  parseUtteranceOffset,
  recordingStartedAtFrom,
  recordingUrlFrom,
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
