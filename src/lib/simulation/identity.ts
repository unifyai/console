/**
 * Builds the mock `User`/`Session` the identity boundary hands back when
 * simulation mode is on. Pure (no `next/headers`): callers resolve the active
 * scenario/workspace and pass them in.
 */

import { mockApiKey } from './config';
import type { MockScenario } from './types';
import type { Session, User, UserOrganization } from '@/types/user';

function buildOrganizations(scenario: MockScenario): UserOrganization[] {
  return scenario.user.organizations.map((org) => ({
    id: org.id,
    name: org.name,
    ownerId: org.ownerId,
    roleId: org.roleId,
    roleName: org.roleName,
    apiKey: mockApiKey(scenario.id, String(org.id)),
    image: org.image ?? null,
    freeTrial: org.freeTrial ?? false,
  }));
}

/** Builds the `User` for the active scenario/workspace with scenario-encoded keys. */
export function buildMockUser(scenario: MockScenario, workspaceId: string): User {
  const organizations = buildOrganizations(scenario);
  const activeOrg = organizations.find((o) => String(o.id) === workspaceId);
  return {
    id: scenario.user.id,
    name: scenario.user.name,
    lastName: scenario.user.lastName,
    jobTitle: scenario.user.jobTitle,
    bio: scenario.user.bio,
    image: scenario.user.image,
    timezone: scenario.user.timezone,
    email: scenario.user.email,
    phoneNumber: scenario.user.phoneNumber,
    whatsappNumber: scenario.user.whatsappNumber,
    discordId: scenario.user.discordId,
    createdAt: scenario.user.createdAt,
    apiKey: mockApiKey(scenario.id, workspaceId),
    stripeCustomerId: scenario.user.stripeCustomerId,
    organization: activeOrg
      ? { name: activeOrg.name, roleId: activeOrg.roleId, roleName: activeOrg.roleName }
      : { name: '', roleId: 0, roleName: '' },
    organizations,
  };
}

/** Builds the NextAuth-shaped session for the active scenario. */
export function buildMockSession(scenario: MockScenario, workspaceId: string): Session {
  return {
    user: {
      id: scenario.user.id,
      name: `${scenario.user.name} ${scenario.user.lastName}`.trim(),
      email: scenario.user.email,
      image: scenario.user.image,
      createdAt: scenario.user.createdAt,
      apiKey: mockApiKey(scenario.id, workspaceId),
    },
  };
}
