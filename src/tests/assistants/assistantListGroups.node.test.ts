import { describe, expect, it } from 'vitest';
import { groupAssistantsByTeam } from '@/components/Pages/Assistants/List/assistantListGroups';
import type { Assistant } from '@/types/assistants/assistant';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';

function makeAssistant(overrides: Partial<Assistant>): Assistant {
  return {
    agentId: '1',
    userId: 'user-1',
    organizationId: 7,
    isCoordinator: false,
    firstName: 'Ada',
    surname: 'Lovelace',
    teamIds: [],
    teamSummaries: [],
    ownerTeamId: null,
    ...overrides,
  } as unknown as Assistant;
}

const teamsById: Record<number, SharedTeamSummary> = {
  3: { teamId: 3, name: 'Support' } as SharedTeamSummary,
  9: { teamId: 9, name: 'Sales' } as SharedTeamSummary,
};

describe('groupAssistantsByTeam — team-owned assistants', () => {
  it('lists a team-owned assistant primarily under its owning team', () => {
    const assistant = makeAssistant({
      agentId: '10',
      ownerTeamId: 3,
      teamIds: [9, 3],
    });

    const groups = groupAssistantsByTeam([assistant], teamsById);
    const supportGroup = groups.find((group) => group.id === 'team:3');
    const salesGroup = groups.find((group) => group.id === 'team:9');

    expect(supportGroup?.rows[0].isPrimaryTeamListing).toBe(true);
    expect(supportGroup?.rows[0].isTeamOwnedListing).toBe(true);
    expect(salesGroup?.rows[0].isPrimaryTeamListing).toBe(false);
    expect(salesGroup?.rows[0].isTeamOwnedListing).toBe(false);
  });

  it('includes the owning team even before membership payloads refresh', () => {
    const assistant = makeAssistant({
      agentId: '11',
      ownerTeamId: 3,
      teamIds: [],
    });

    const groups = groupAssistantsByTeam([assistant], teamsById);
    const supportGroup = groups.find((group) => group.id === 'team:3');

    expect(supportGroup?.rows).toHaveLength(1);
    expect(supportGroup?.rows[0].isTeamOwnedListing).toBe(true);
    expect(groups.find((group) => group.id === 'solo')).toBeUndefined();
  });

  it('keeps user-owned grouping unchanged', () => {
    const assistant = makeAssistant({
      agentId: '12',
      ownerTeamId: null,
      teamIds: [9, 3],
    });

    const groups = groupAssistantsByTeam([assistant], teamsById);
    const salesGroup = groups.find((group) => group.id === 'team:9');
    const supportGroup = groups.find((group) => group.id === 'team:3');

    // Primary listing is the first membership (ids sorted ascending), and no
    // team-owned flags anywhere.
    expect(supportGroup?.rows[0].isPrimaryTeamListing).toBe(true);
    expect(supportGroup?.rows[0].isTeamOwnedListing).toBe(false);
    expect(salesGroup?.rows[0].isPrimaryTeamListing).toBe(false);
    expect(salesGroup?.rows[0].isTeamOwnedListing).toBe(false);
  });
});
