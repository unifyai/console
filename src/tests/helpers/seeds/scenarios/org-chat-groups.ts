/**
 * Seed Scenario: Org chat Groups
 *
 * Creates an org with two humans and two assistants, plus one mixed chat
 * group so the Groups rail section is immediately usable for local testing.
 *
 * **What it creates:**
 *   - 2 users ("owner", "member")
 *   - 1 organization with org-wide sharing enabled
 *   - 2 org assistants
 *   - 1 chat group containing both humans and both assistants
 *
 * **Credentials:**
 *   - `owner` — org owner (group creator)
 *   - `member` — org member in the group
 */

import type { SeededState } from '../types';
import {
  createUser,
  createOrg,
  addMember,
  createAssistant,
  createEmailLogin,
  createChatGroup,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
} from '../client';

export async function seedOrgChatGroups(): Promise<SeededState> {
  const owner = createUser({ name: 'Group', lastName: 'Owner' });
  const member = createUser({ name: 'Group', lastName: 'Member' });
  createEmailLogin({ userId: owner.id });
  createEmailLogin({ userId: member.id });

  const org = createOrg({
    name: 'Test Org Chat Groups',
    ownerId: owner.id,
    dataSharingMode: 'shared',
  });

  const memberOrgKey = addMember({ orgId: org.id, userId: member.id, role: 'Member' });

  const assistantOne = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'GroupBot',
    surname: 'Alpha',
  });
  const assistantTwo = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'GroupBot',
    surname: 'Beta',
  });

  await seedChatInfrastructure({
    apiKey: org.ownerOrgApiKey,
    userId: owner.id,
    assistantId: assistantOne.agentId,
    email: owner.email,
  });
  await seedChatInfrastructure({
    apiKey: org.ownerOrgApiKey,
    userId: owner.id,
    assistantId: assistantTwo.agentId,
    email: owner.email,
  });

  createChatGroup({
    organizationId: org.id,
    name: 'Seed Mixed Group',
    createdByUserId: owner.id,
    userIds: [owner.id, member.id],
    assistantIds: [assistantOne.agentId, assistantTwo.agentId],
  });

  await seedCoordinatorChatForUsers([owner, member]);

  return {
    users: { owner, member },
    org,
    assistants: [assistantOne, assistantTwo],
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: org.ownerOrgApiKey,
        userId: owner.id,
      },
      member: {
        email: member.email,
        password: 'testpass123',
        apiKey: memberOrgKey,
        userId: member.id,
      },
    },
  };
}
