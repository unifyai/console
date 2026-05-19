import { describe, expect, it } from 'vitest';

import type { TranscriptRow } from '@/types/assistants/memory';
import { formatTranscriptSenderLabel } from '@/utils/assistants/memory';

function transcriptRow(overrides: Partial<TranscriptRow>): TranscriptRow {
  return {
    messageId: 1,
    medium: 'unify_message',
    senderId: 0,
    receiverIds: [1],
    authoringAssistantId: 42,
    timestamp: '2026-05-19T13:00:00Z',
    content: 'hello',
    exchangeId: 1,
    ...overrides,
  };
}

describe('formatTranscriptSenderLabel', () => {
  it('uses the selected assistant name for locally authored assistant rows', () => {
    const label = formatTranscriptSenderLabel(transcriptRow({}), new Map(), {
      assistantContactIds: new Set([0]),
      assistantDisplayName: 'Head of Repairs',
      selectedAssistantId: 42,
      assistantNamesById: new Map([[42, 'Head of Repairs']]),
    });

    expect(label).toBe('Head of Repairs (0)');
  });

  it('uses authoring assistant identity for cross-assistant shared rows', () => {
    const label = formatTranscriptSenderLabel(
      transcriptRow({ authoringAssistantId: 77 }),
      new Map(),
      {
        assistantContactIds: new Set([0]),
        assistantDisplayName: 'Head of Repairs',
        selectedAssistantId: 42,
        assistantNamesById: new Map([[77, 'Central South Patch 1 Supervisor']]),
      }
    );

    expect(label).toBe('Central South Patch 1 Supervisor (0)');
  });

  it('supports snake_case authoring assistant ids from transcript rows', () => {
    const rowWithSnakeCaseAuthor = transcriptRow({ authoringAssistantId: null }) as TranscriptRow &
      Record<string, unknown>;
    rowWithSnakeCaseAuthor['authoring_assistant_id'] = 77;
    const label = formatTranscriptSenderLabel(rowWithSnakeCaseAuthor, new Map(), {
      assistantContactIds: new Set([0]),
      assistantDisplayName: 'Head of Repairs',
      selectedAssistantId: 42,
      assistantNamesById: new Map([[77, 'Central South Patch 1 Supervisor']]),
    });

    expect(label).toBe('Central South Patch 1 Supervisor (0)');
  });

  it('falls back to assistant id when authoring name is unavailable', () => {
    const label = formatTranscriptSenderLabel(
      transcriptRow({ authoringAssistantId: 88 }),
      new Map(),
      {
        assistantContactIds: new Set([0]),
        assistantDisplayName: 'Head of Repairs',
        selectedAssistantId: 42,
        assistantNamesById: new Map(),
      }
    );

    expect(label).toBe('Assistant 88 (0)');
  });

  it('falls back to selected assistant label for legacy rows without authoring metadata', () => {
    const label = formatTranscriptSenderLabel(
      transcriptRow({ authoringAssistantId: null }),
      new Map(),
      {
        assistantContactIds: new Set([0]),
        assistantDisplayName: 'Head of Repairs',
        selectedAssistantId: 42,
      }
    );

    expect(label).toBe('Head of Repairs (0)');
  });

  it('uses contact names for non-assistant sender ids', () => {
    const label = formatTranscriptSenderLabel(
      transcriptRow({ senderId: 15, authoringAssistantId: 77 }),
      new Map([[15, 'Darren']]),
      {
        assistantContactIds: new Set([0]),
        assistantDisplayName: 'Head of Repairs',
        selectedAssistantId: 42,
        assistantNamesById: new Map([[77, 'Central South Patch 1 Supervisor']]),
      }
    );

    expect(label).toBe('Darren (15)');
  });
});
