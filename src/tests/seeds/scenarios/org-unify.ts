/**
 * Seed Scenario: Organization + Outsider
 *
 * Creates a Unify organization with its owner and a completely separate
 * user who is **not** a member of the organization.
 *
 * Useful for testing visibility/access boundaries: the outsider should
 * not see org assistants, secrets, members, etc.
 *
 * **What it creates:**
 *   - 2 users ("owner", "outsider")
 *   - 1 organization owned by the owner
 *   - 1 org assistant created by the owner
 *   - 1 personal assistant for the outsider
 *
 * **Credentials:**
 *   - `owner`    — full org access
 *   - `outsider` — personal workspace only, no org membership
 */

import type { SeededState } from '../types';
import {
  createUser,
  createOrg,
  createAssistant,
  createEmailLogin,
} from '../client';

export async function seedOrgAndOutsider(): Promise<SeededState> {
  // ── Org owner ──────────────────────────────────────────────────────
  const owner = createUser({ name: 'Org', lastName: 'Owner' });
  createEmailLogin({ userId: owner.id });

  const org = createOrg({ name: 'Unify', ownerId: owner.id });

  const orgAssistant = createAssistant({
    userId: owner.id,
    orgId: org.id,
    firstName: 'OrgBot',
    surname: 'Alpha',
  });

  // ── Outsider (not in the org) ──────────────────────────────────────
  const outsider = createUser({ name: 'Outside', lastName: 'User' });
  createEmailLogin({ userId: outsider.id });

  const personalAssistant = createAssistant({
    userId: outsider.id,
    firstName: 'Solo',
    surname: 'Helper',
  });

  return {
    users: { owner, outsider },
    org,
    assistants: [orgAssistant, personalAssistant],
    credentials: {
      owner: {
        email: owner.email,
        password: 'testpass123',
        apiKey: org.ownerOrgApiKey,
        userId: owner.id,
      },
      outsider: {
        email: outsider.email,
        password: 'testpass123',
        apiKey: outsider.apiKey,
        userId: outsider.id,
      },
    },
  };
}

