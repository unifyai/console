import { describe, expect, it } from 'vitest';

import { Assistant } from '@/types/assistants/assistant';
import { readAcrossRoots } from '@/lib/client/read_across_roots';

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
  spaceIds: [2, 1],
  selfContactId: 5,
  bossContactId: 6,
  createdAt: '2026-05-01T10:00:00Z',
  updatedAt: '2026-05-01T10:00:00Z',
};

describe('readAcrossRoots', () => {
  it('fans out across roots and flattens by deterministic root order', async () => {
    const result = await readAcrossRoots(assistant, async (root) => {
      if (root.kind === 'personal') {
        return ['personal'];
      }
      if (root.spaceId === 1) {
        return ['space-1'];
      }
      return ['space-2'];
    });

    expect(result).toEqual(['personal', 'space-1', 'space-2']);
  });

  it('rejects when any root read fails', async () => {
    await expect(
      readAcrossRoots(assistant, async (root) => {
        if (root.kind === 'space' && root.spaceId === 1) {
          throw new Error('space unavailable');
        }
        return ['ok'];
      })
    ).rejects.toThrow('space unavailable');
  });
});
