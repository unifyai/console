/**
 * Identity fixtures: the mock users, orgs, and personas backing each scenario.
 */

import type { MockOrg, MockPersona, MockUser } from '../types';

export const MOCK_USER_ID = 'mock-user-0001';
export const MOCK_ORG_ID = 4242;

const NOW = '2026-01-15T09:00:00.000Z';

/**
 * Fixtures carry an empty `apiKey`; the identity boundary fills each one with a
 * scenario-encoded mock key at request time (the same fixture is reused across
 * scenarios, so the key cannot be baked in statically).
 */
const PLACEHOLDER_KEY = '';

export const personalUser: MockUser = {
  id: MOCK_USER_ID,
  name: 'Ada',
  lastName: 'Mock',
  jobTitle: 'Founder',
  bio: 'Exploring the Console in simulation mode.',
  image: '',
  email: 'ada@mock.local',
  timezone: 'Europe/London',
  phoneNumber: null,
  whatsappNumber: null,
  discordId: null,
  createdAt: '2025-09-01T12:00:00.000Z',
  apiKey: PLACEHOLDER_KEY,
  stripeCustomerId: 'cus_mock_0001',
  organizations: [],
};

export const acmeOrg: MockOrg = {
  id: MOCK_ORG_ID,
  name: 'Acme Labs',
  ownerId: MOCK_USER_ID,
  roleId: 1,
  roleName: 'Owner',
  apiKey: PLACEHOLDER_KEY,
  image: null,
  freeTrial: false,
};

/** A user who also owns an organization workspace. */
export const orgOwnerUser: MockUser = {
  ...personalUser,
  jobTitle: 'CEO',
  organizations: [acmeOrg],
};

export const soloPersonas: MockPersona[] = [
  { id: 'owner', label: 'Ada (personal)', workspaceId: 'personal' },
];

export const orgPersonas: MockPersona[] = [
  { id: 'owner', label: 'Ada — Owner', workspaceId: String(MOCK_ORG_ID) },
  { id: 'personal', label: 'Ada — personal workspace', workspaceId: 'personal' },
];

export { NOW as MOCK_FIXTURE_TIMESTAMP };
