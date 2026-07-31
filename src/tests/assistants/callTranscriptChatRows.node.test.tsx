/**
 * Meeting-chat rows in the call transcript dialog.
 *
 * A chat line is recorded on the call like a spoken one, so it arrives with a
 * position in the timeline -- but there is no audio behind it. Offering a seek
 * control would jump the recording to whatever was being *said* at that moment,
 * which is not what the row shows. These tests pin the distinction, which is
 * invisible in the e2e suite: it only counts rows.
 */
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CallTranscriptDialog } from '@/components/Chat/CallTranscriptDialog';
import type { CallPill, CallTranscriptUtterance } from '@/types/assistants/chat';

vi.mock('@/components/Pages/Assistants/Transcripts/TranscriptRecordingPlayer', () => ({
  TranscriptRecordingPlayer: () => <div data-testid="recording-player" />,
}));

const RECORDING_STARTED_AT = new Date('2026-07-30T10:00:00Z').getTime();

const PILL: CallPill = {
  id: 'pill-1',
  type: 'call_pill',
  timestamp: new Date('2026-07-30T10:05:00Z'),
  durationSeconds: 300,
  recordingUrl: 'https://example.com/recording.mp4',
  recordingStartedAtMs: RECORDING_STARTED_AT,
};

function utterance(over: Partial<CallTranscriptUtterance>): CallTranscriptUtterance {
  return {
    id: 'u1',
    role: 'user',
    content: 'spoken line',
    timestamp: new Date('2026-07-30T10:00:30Z'),
    ...over,
  };
}

function renderDialog(utterances: CallTranscriptUtterance[]) {
  return render(
    <CallTranscriptDialog
      open
      onOpenChange={() => {}}
      pill={PILL}
      utterances={utterances}
      loading={false}
    />
  );
}

describe('call transcript chat rows', () => {
  it('gives a chat row a bubble icon and no seek button', () => {
    renderDialog([utterance({ id: 'c1', content: 'here is the doc', isChat: true })]);

    expect(screen.getByTestId('call-transcript-chat-icon')).toBeTruthy();
    expect(screen.queryByTestId('call-transcript-seek-button')).toBeNull();
  });

  it('still shows where the chat row falls in the call', () => {
    // Dropping the timestamp with the button would lose the only cue for when
    // it was typed.
    renderDialog([
      utterance({
        id: 'c1',
        content: 'here is the doc',
        isChat: true,
        timestamp: new Date('2026-07-30T10:00:30Z'),
      }),
    ]);

    expect(screen.getByText('0:30')).toBeTruthy();
  });

  it('leaves spoken rows playable', () => {
    // The guard must key on the row, not disable seeking for the whole call
    // once one chat message arrives.
    renderDialog([
      utterance({ id: 'c1', content: 'here is the doc', isChat: true }),
      utterance({ id: 's1', content: 'as I was saying' }),
    ]);

    expect(screen.getAllByTestId('call-transcript-seek-button')).toHaveLength(1);
    expect(screen.getAllByTestId('call-transcript-chat-icon')).toHaveLength(1);
  });

  it('marks no row as chat when none is', () => {
    renderDialog([utterance({ id: 's1' })]);

    expect(screen.queryByTestId('call-transcript-chat-icon')).toBeNull();
    expect(screen.getByTestId('call-transcript-seek-button')).toBeTruthy();
  });
});
