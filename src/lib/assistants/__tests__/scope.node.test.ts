import { describe, expect, it } from 'vitest';

import { Assistant } from '@/types/assistants/assistant';
import {
  bossContactId,
  currentSpaceIds,
  isBoss,
  isSelf,
  roots,
  selfContactId,
} from '@/lib/assistants/scope';

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
  spaceIds: [],
  selfContactId: null,
  bossContactId: null,
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
};

describe('assistant scope helpers', () => {
  it('uses resolved self and boss contact ids when present', () => {
    expect(selfContactId({ ...assistant, selfContactId: 5 })).toBe(5);
    expect(bossContactId({ ...assistant, bossContactId: 6 })).toBe(6);
  });

  it('falls back to personal contact ids when the overlay is unresolved', () => {
    expect(selfContactId(assistant)).toBe(0);
    expect(bossContactId(assistant)).toBe(1);
  });

  it('identifies self and boss contacts through the resolved ids', () => {
    const scopedAssistant = { ...assistant, selfContactId: 9, bossContactId: 10 };

    expect(isSelf(scopedAssistant, 9)).toBe(true);
    expect(isSelf(scopedAssistant, 10)).toBe(false);
    expect(isBoss(scopedAssistant, 10)).toBe(true);
    expect(isBoss(scopedAssistant, 9)).toBe(false);
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
});
