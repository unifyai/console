import { describe, expect, it, vi } from 'vitest';

import { contactScopedRootQueries } from '@/lib/assistants/scope';
import type { Assistant } from '@/types/assistants/assistant';

const assistant: Assistant = {
  agentId: '42',
  userId: 'user-1',
  organizationId: null,
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
  spaceIds: [7],
  selfContactId: 10,
  bossContactId: 11,
  contactIdentityRoots: [
    {
      targetScope: 'personal',
      targetSpaceId: null,
      selfContactId: 10,
      bossContactId: 11,
    },
    {
      targetScope: 'space',
      targetSpaceId: 7,
      selfContactId: 70,
      bossContactId: 77,
    },
  ],
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
};

describe('root-local contact identity', () => {
  it('resolves personal and shared contact ids for the same owner', () => {
    expect(contactScopedRootQueries(assistant, 11, 'Transcripts')).toEqual([
      {
        root: { kind: 'personal' },
        rootKey: 'personal',
        context: 'user-1/42/Transcripts',
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

  it('omits unresolved shared roots without substituting personal ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unresolved = {
      ...assistant,
      spaceIds: [7, 9],
      contactIdentityRoots: assistant.contactIdentityRoots.filter(
        (identity) => identity.targetScope !== 'space'
      ),
    };

    expect(contactScopedRootQueries(unresolved, 11, 'Transcripts')).toEqual([
      {
        root: { kind: 'personal' },
        rootKey: 'personal',
        context: 'user-1/42/Transcripts',
        contactId: 11,
        selfContactId: 10,
      },
    ]);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('keeps personal reads available when root identity metadata is absent', () => {
    const assistantWithoutProjectedRoots = {
      ...assistant,
      spaceIds: [7],
      contactIdentityRoots: undefined as unknown as Assistant['contactIdentityRoots'],
    };

    expect(contactScopedRootQueries(assistantWithoutProjectedRoots, 11, 'Transcripts')).toEqual([
      {
        root: { kind: 'personal' },
        rootKey: 'personal',
        context: 'user-1/42/Transcripts',
        contactId: 11,
        selfContactId: 10,
      },
    ]);
  });
});
