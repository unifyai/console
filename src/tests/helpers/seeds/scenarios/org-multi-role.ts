/**
 * Seed Scenario: Organization — Multi-Role
 *
 * Creates an organization with users in every standard role (Owner, Admin,
 * Member, Viewer) and one org assistant. Designed for permission matrix tests.
 *
 * **What it creates:**
 *   - 4 users ("owner", "admin", "member", "viewer")
 *   - 1 organization
 *   - Each user has their respective org role
 *   - 1 org assistant created by the owner
 *
 * **Credentials:**
 *   - `owner`  — full org access (Owner role)
 *   - `admin`  — Admin role
 *   - `member` — Member role
 *   - `viewer` — Viewer role (read-only)
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

export async function seedOrgMultiRole(): Promise<SeededState> {
  // Create users for each role
  const owner = createUser({ name: 'Role', lastName: 'Owner' });
  const admin = createUser({ name: 'Role', lastName: 'Admin' });
  const member = createUser({ name: 'Role', lastName: 'Member' });
  const viewer = createUser({ name: 'Role', lastName: 'Viewer' });

  createEmailLogin({ userId: owner.id });
  createEmailLogin({ userId: admin.id });
  createEmailLogin({ userId: member.id });
  createEmailLogin({ userId: viewer.id });

  // Create org (owner is automatically added with Owner role)
  const org = createOrg({ name: 'Test Org Multi-Role', ownerId: owner.id });

  // Add remaining members
  const adminOrgKey = addMember({ orgId: org.id, userId: admin.id, role: 'Admin' });
  const memberOrgKey = addMember({ orgId: org.id, userId: member.id, role: 'Member' });
  const viewerOrgKey = addMember({ orgId: org.id, userId: viewer.id, role: 'Viewer' });

  // Create an org assistant
  const assistant = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'PermBot',
    surname: 'MultiRole',
  });

  await seedChatInfrastructure({
    apiKey: org.ownerOrgApiKey,
    userId: owner.id,
    assistantId: assistant.agentId,
    email: owner.email,
  });

  // Each role's user gets their own personal Coordinator. Seed chat
  // infra for all four so any account can open their Coordinator panel
  // immediately after quick-login.
  await seedCoordinatorChatForUsers([owner, admin, member, viewer]);

  return {
    users: { owner, admin, member, viewer },
    org,
    assistants: [assistant],
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: org.ownerOrgApiKey,
        userId: owner.id,
      },
      admin: { email: admin.email, password: 'testpass123', apiKey: adminOrgKey, userId: admin.id },
      member: {
        email: member.email,
        password: 'testpass123',
        apiKey: memberOrgKey,
        userId: member.id,
      },
      viewer: {
        email: viewer.email,
        password: 'testpass123',
        apiKey: viewerOrgKey,
        userId: viewer.id,
      },
    },
  };
}
