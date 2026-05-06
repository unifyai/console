import { describe, expect, it } from 'vitest';

import { Assistant } from '@/types/assistants/assistant';
import {
  bossContactId,
  contactScopedRootQueries,
  currentSpaceIds,
  isBoss,
  isSelf,
  meetExchangeFilter,
  roleFromSenderId,
  roots,
  transcriptFilter,
  selfContactId,
} from '@/lib/assistants/scope';

const assistant: Assistant = {
  agentId: '42',
  userId: 'user-1',
  organizationId: null,
  isCoordinator: false,
  firstName: 'Ava',
  surname: 'Repairs',
  jobTitle: null,
  profilePhoto: null,
  profileVideo: null,
  age: null,
  nationality: null,
  about: null,
  phoneCountry: null,
  timezone: null,
  voiceId: null,
  voiceProvider: null,
  email: null,
  phone: null,
  assistantWhatsappNumber: null,
  assistantDiscordBotId: null,
  userPhone: null,
  userWhatsappNumber: null,
  userDiscordId: null,
  weeklyLimit: null,
  maxParallel: null,
  spaceIds: [],
  selfContactId: 5,
  bossContactId: 6,
  contactIdentityRoots: [
    {
      targetScope: 'personal',
      targetSpaceId: null,
      selfContactId: 5,
      bossContactId: 6,
    },
  ],
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
};

describe('assistant scope helpers', () => {
  it('uses resolved self and boss contact ids when present', () => {
    expect(selfContactId({ ...assistant, selfContactId: 5 })).toBe(5);
    expect(bossContactId({ ...assistant, bossContactId: 6 })).toBe(6);
  });

  it('identifies self and boss contacts through the resolved ids', () => {
    const scopedAssistant = {
      ...assistant,
      selfContactId: 9,
      bossContactId: 10,
    };

    expect(isSelf(scopedAssistant, 9)).toBe(true);
    expect(isSelf(scopedAssistant, 10)).toBe(false);
    expect(isBoss(scopedAssistant, 10)).toBe(true);
    expect(isBoss(scopedAssistant, 9)).toBe(false);
    expect(roleFromSenderId(scopedAssistant, 9)).toBe('assistant');
    expect(roleFromSenderId(scopedAssistant, 10)).toBe('user');
  });

  it('builds transcript and meet filters from resolved self ids', () => {
    const scopedAssistant = {
      ...assistant,
      selfContactId: 42,
      bossContactId: 43,
    };

    expect(transcriptFilter(scopedAssistant, 43)).toBe(
      'medium == "unify_message" and (sender_id == 43 or (sender_id == 42 and 43 in receiver_ids))'
    );
    expect(meetExchangeFilter(scopedAssistant, 43)).toBe(
      'medium == "unify_meet" and (sender_id == 43 or sender_id == 42) and (43 in receiver_ids or receiver_ids == [42])'
    );
  });

  it('returns personal first followed by sorted space roots', () => {
    const scopedAssistant = { ...assistant, spaceIds: [3, 1, 2] };

    expect(currentSpaceIds(scopedAssistant)).toEqual([1, 2, 3]);
    expect(roots(scopedAssistant)).toEqual([
      { kind: 'personal' },
      { kind: 'space', spaceId: 1 },
      { kind: 'space', spaceId: 2 },
      { kind: 'space', spaceId: 3 },
    ]);
  });

  it('builds contact-scoped queries with root-local contact ids', () => {
    const scopedAssistant = {
      ...assistant,
      userId: 'owner',
      agentId: 'assistant',
      spaceIds: [7],
      selfContactId: 10,
      bossContactId: 11,
      contactIdentityRoots: [
        {
          targetScope: 'personal' as const,
          targetSpaceId: null,
          selfContactId: 10,
          bossContactId: 11,
        },
        {
          targetScope: 'space' as const,
          targetSpaceId: 7,
          selfContactId: 70,
          bossContactId: 77,
        },
      ],
    };

    expect(contactScopedRootQueries(scopedAssistant, 11, 'Transcripts')).toEqual([
      {
        root: { kind: 'personal' },
        rootKey: 'personal',
        context: 'owner/assistant/Transcripts',
        contactId: 11,
        selfContactId: 10,
      },
      {
        root: { kind: 'space', spaceId: 7 },
        rootKey: 'space-7',
        context: 'Spaces/7/Transcripts',
        contactId: 77,
        selfContactId: 70,
      },
    ]);
  });
});
