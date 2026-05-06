import { describe, expect, it } from 'vitest';

import { groupAssistantsBySpace } from '../assistantListGroups';
import type { Assistant } from '@/types/assistants/assistant';
import type { SpaceSummary } from '@/types/spaces/space';

function assistant(
  agentId: string,
  firstName: string,
  surname: string,
  spaceIds: number[],
  extra: Partial<Assistant> & { isCoordinator?: boolean } = {}
): Assistant {
  return {
    agentId,
    userId: 'user-1',
    organizationId: null,
    firstName,
    surname,
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
    spaceIds,
    selfContactId: 9,
    bossContactId: 10,
    contactIdentityRoots: [],
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    ...extra,
  };
}

function space(spaceId: number, name: string): SpaceSummary {
  return {
    spaceId,
    name,
    description: null,
    organizationId: null,
    status: 'active',
  };
}

describe('groupAssistantsBySpace', () => {
  it('groups by space id in ascending order', () => {
    const groups = groupAssistantsBySpace(
      [
        assistant('12', 'Twelve', 'Patch', [12]),
        assistant('7', 'Seven', 'Patch', [7]),
        assistant('3', 'Three', 'Patch', [3]),
      ],
      {
        3: space(3, 'Patch Three'),
        7: space(7, 'Patch Seven'),
        12: space(12, 'Patch Twelve'),
      }
    );

    expect(groups.map((group) => group.id)).toEqual(['space:3', 'space:7', 'space:12']);
  });

  it('marks primary listings and exposes other space labels for multi-space assistants', () => {
    const groups = groupAssistantsBySpace([assistant('42', 'Mina', 'Multi', [7, 3])], {
      3: space(3, 'Patch Three'),
      7: space(7, 'Patch Seven'),
    });

    expect(groups).toHaveLength(2);
    expect(groups[0].id).toBe('space:3');
    expect(groups[0].rows[0]).toMatchObject({
      isPrimarySpaceListing: true,
      alsoInSpaceLabels: ['Patch Seven'],
    });
    expect(groups[1].id).toBe('space:7');
    expect(groups[1].rows[0]).toMatchObject({
      isPrimarySpaceListing: false,
      alsoInSpaceLabels: ['Patch Three'],
    });
  });

  it('collects spaceless assistants in the solo group', () => {
    const groups = groupAssistantsBySpace(
      [assistant('1', 'Solo', 'One', []), assistant('2', 'Shared', 'One', [5])],
      { 5: space(5, 'Patch Five') }
    );

    expect(groups.map((group) => group.id)).toEqual(['space:5', 'solo']);
    expect(groups[1].rows.map((entry) => entry.assistant.agentId)).toEqual(['1']);
  });

  it('uses a synthetic label for unknown space ids', () => {
    const groups = groupAssistantsBySpace([assistant('99', 'Unknown', 'Space', [99])], {});

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 'space:99', label: 'Space 99' });
  });

  it('sorts assistants inside each group by name and id', () => {
    const groups = groupAssistantsBySpace(
      [
        assistant('3', 'Zoe', 'Patch', [1]),
        assistant('2', 'Ana', 'Zulu', [1]),
        assistant('1', 'Ana', 'Alpha', [1]),
      ],
      { 1: space(1, 'Patch One') }
    );

    expect(groups[0].rows.map((entry) => entry.assistant.agentId)).toEqual(['1', '2', '3']);
  });

  it('accepts assistants without a Coordinator flag', () => {
    const groups = groupAssistantsBySpace([assistant('1', 'No', 'Flag', [])], {});

    expect(groups.map((group) => group.id)).toEqual(['solo']);
  });

  it('pins Coordinator-shaped assistants above space groups', () => {
    const groups = groupAssistantsBySpace(
      [assistant('1', 'Coordinator', 'One', [5], { isCoordinator: true })],
      { 5: space(5, 'Patch Five') }
    );

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ id: 'pinned', label: 'Pinned' });
  });
});
