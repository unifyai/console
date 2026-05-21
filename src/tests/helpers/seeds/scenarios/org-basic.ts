/**
 * Seed Scenario: Organization — Basic
 *
 * Creates a minimal organization with an owner and one member,
 * plus one organizational assistant owned by the org owner.
 *
 * **What it creates:**
 *   - 2 users ("owner", "member")
 *   - 1 organization
 *   - Owner has Owner role, member has Member role
 *   - 1 org assistant created by the owner
 *
 * **Credentials:**
 *   - `owner` — full org access
 *   - `member` — limited member access
 */

import type { SeededState } from '../types';
import {
  createUser,
  createOrg,
  addMember,
  createAssistant,
  createEmailLogin,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
} from '../client';

export async function seedOrgBasic(): Promise<SeededState> {
  // Create users
  const owner = createUser({ name: 'Org', lastName: 'Owner' });
  const member = createUser({ name: 'Org', lastName: 'Member' });
  createEmailLogin({ userId: owner.id });
  createEmailLogin({ userId: member.id });

  // Create org
  const org = createOrg({ name: 'Test Org Basic', ownerId: owner.id });

  // Add member
  const memberOrgKey = addMember({ orgId: org.id, userId: member.id, role: 'Member' });

  // Create an assistant under the org
  const assistant = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'OrgBot',
    surname: 'One',
  });

  await seedChatInfrastructure({
    apiKey: org.ownerOrgApiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  // Every user — owner and member — gets a personal Coordinator
  // (organization_id IS NULL), mirroring production signup. Wire up
  // their chat infra so both workspaces are immediately usable.
  await seedCoordinatorChatForUsers([owner, member]);

  return {
    users: { owner, member },
    org,
    assistants: [assistant],
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
