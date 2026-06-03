/**
 * Seed Scenario: Sidebar Space Grouping
 *
 * Personal workspace with a Coordinator, one shared team space, and several
 * independent colleagues — mirrors the manual repro for the assistant list
 * kebab menu in grouped sidebar rows.
 */

import type { SeededState } from '../types';
import {
  createUser,
  createAssistant,
  createEmailLogin,
  createSpaceForAssistant,
  seedCoordinatorChatForUsers,
} from '../client';

export async function seedSidebarSpaceGrouping(): Promise<SeededState> {
  const owner = createUser({ name: 'Yusha', lastName: 'Demo' });
  createEmailLogin({ userId: owner.id });

  const teamColleague = createAssistant({
    userId: owner.id,
    firstName: 'Mikasa',
    surname: 'Ackerman',
    jobTitle: 'Southwest Sales Patch Specialist',
  });
  const andrew = createAssistant({
    userId: owner.id,
    firstName: 'Andrew',
    surname: 'Scott',
  });
  const eren = createAssistant({
    userId: owner.id,
    firstName: 'Eren',
    surname: 'Yeager',
    jobTitle: 'Virtual Colleague',
  });
  const ito = createAssistant({
    userId: owner.id,
    firstName: 'Ito',
    surname: 'Takahashi',
  });

  createSpaceForAssistant(teamColleague, {
    name: 'Southwest Sales Team',
    description:
      'Workspace/team grouping for the Southwest Sales patch. Includes Mikasa Ackerman and related patch workflows.',
    selfContactId: 801,
    bossContactId: 802,
  });

  await seedCoordinatorChatForUsers([owner]);

  const assistants = [teamColleague, andrew, eren, ito];

  return {
    users: { owner },
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
