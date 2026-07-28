import { describe, expect, it } from 'vitest';
import {
  activeCueMessageId,
  formatClock,
  isCallExchange,
  parseUtteranceOffset,
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
