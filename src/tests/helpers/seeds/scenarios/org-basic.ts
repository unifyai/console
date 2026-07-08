/**
 * Seed Scenario: Organization — Basic
 *
 * Creates a minimal shared organization with an owner and one member,
 * plus one organizational assistant owned by the org owner.
 *
 * **What it creates:**
 *   - 2 users ("owner", "member")
 *   - 1 organization with org-wide sharing enabled
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
  createMsTeamsBotInstall,
  seedChatInfrastructure,
  seedCoordinatorChatForUsers,
} from '../client';

/**
 * Fixed bind code for the pending MS Teams bot install seeded below, so
 * a local tester (via DevQuickLogin as the org owner) can walk the
 * Teams bot bind handshake without inventing a nonce.
 */
export const ORG_BASIC_MS_TEAMS_BOT_BIND_NONCE = 'seed-org-basic-teams-nonce';

export async function seedOrgBasic(): Promise<SeededState> {
  // Create users
  const owner = createUser({ name: 'Org', lastName: 'Owner' });
  const member = createUser({ name: 'Org', lastName: 'Member' });
  createEmailLogin({ userId: owner.id });
  createEmailLogin({ userId: member.id });

  // Create org
  const org = createOrg({
    name: 'Test Org Basic',
    ownerId: owner.id,
    dataSharingMode: 'shared',
  });

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

  // A pending Microsoft Teams bot install waiting to be bound to this
  // org — makes the tenant→org bind handshake reachable locally. Keyed
  // on the org so re-seeding is idempotent.
  createMsTeamsBotInstall({
    tenantId: `seed-org-basic-tenant-${org.id}`,
    tenantName: 'Test Org Basic Tenant',
    bindNonce: ORG_BASIC_MS_TEAMS_BOT_BIND_NONCE,
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
