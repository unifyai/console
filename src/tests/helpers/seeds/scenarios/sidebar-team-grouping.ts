/**
 * Seed Scenario: Sidebar Team Grouping
 *
 * Organization workspace with a Coordinator, one shared team, and several
 * independent colleagues — mirrors the manual repro for the assistant list
 * kebab menu in grouped sidebar rows.
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  createOrg,
  createTeamForAssistant,
  seedCoordinatorChatForUsers,
} from '../client';

export async function seedSidebarTeamGrouping(): Promise<SeededState> {
  const owner = createUser({ name: 'Yusha', lastName: 'Demo' });
  createEmailLogin({ userId: owner.id });
  const org = createOrg({ name: 'Sidebar Team Grouping Org', ownerId: owner.id });

  const teamColleague = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'Mikasa',
    surname: 'Ackerman',
    jobTitle: 'Southwest Sales Patch Specialist',
  });
  const andrew = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'Andrew',
    surname: 'Scott',
  });
  const eren = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'Eren',
    surname: 'Yeager',
    jobTitle: 'Virtual Colleague',
  });
  const ito = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'Ito',
    surname: 'Takahashi',
  });

  createTeamForAssistant(teamColleague, {
    name: 'Southwest Sales Team',
    description:
      'Team grouping for the Southwest Sales patch. Includes Mikasa Ackerman and related patch workflows.',
    selfContactId: 801,
    bossContactId: 802,
  });

  await seedCoordinatorChatForUsers([owner]);

  const assistants = [teamColleague, andrew, eren, ito];

  return {
    users: { owner },
    org,
    assistants,
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: owner.apiKey,
        userId: owner.id,
      },
    },
  };
}
