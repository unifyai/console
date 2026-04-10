/**
 * Seed Scenario: Credit Grant Links
 *
 * Creates multiple users and credit grant links in various states to
 * exercise the admin links page and the claim flow end-to-end.
 *
 * **What it creates:**
 *   - 6 users ("admin_viewer", "alice", "bob", "carol", "dave", "eve")
 *   - 1 "Unify" organization (admin_viewer is the owner)
 *   - Credit grant links in every interesting state:
 *       1. Active single-use link (unclaimed)
 *       2. Claimed single-use link (claimed by alice)
 *       3. Expired unclaimed link
 *       4. Active multi-use link (max_claims=5, unclaimed)
 *       5. Partially claimed multi-use link (max_claims=5, 2 claimed)
 *       6. Exhausted multi-use link (max_claims=3, fully claimed)
 *       7. Expired multi-use link with partial claims
 *       8. Large budget link (max_claims=50, 1 claimed)
 *
 * **Credentials:**
 *   - `admin_viewer` — Unify org owner, views the admin links page
 *   - `alice` through `eve` — users who claim various links
 */

import type { SeededState } from '../types';
import { createUser, createOrg, createEmailLogin, orchestraFetch, dbExec } from '../client';

const ADMIN_KEY = process.env.ORCHESTRA_ADMIN_KEY || 'local-admin-key';

// ─── helpers ────────────────────────────────────────────────────────────────

interface LinkCreateResponse {
  id: string;
  token: string;
}

async function createLink(
  expiresInDays: number,
  creditAmount: number,
  maxClaims: number,
  name?: string
): Promise<LinkCreateResponse> {
  const body: Record<string, unknown> = {
    expires_in_days: expiresInDays,
    credit_amount: creditAmount,
    max_claims: maxClaims,
  };
  if (name) body.name = name;

  const res = await orchestraFetch(
    '/v0/admin/credit-grant-link',
    { method: 'POST', body: JSON.stringify(body) },
    ADMIN_KEY
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to create link: ${res.status} ${text}`);
  }
  return (await res.json()) as LinkCreateResponse;
}

async function claimLink(token: string, userApiKey: string): Promise<void> {
  const res = await orchestraFetch(
    '/v0/user/claim-credit-grant-link',
    { method: 'POST', body: JSON.stringify({ token }) },
    userApiKey
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to claim link: ${res.status} ${text}`);
  }
}

function expireLink(linkId: string): void {
  dbExec(
    `UPDATE one_time_credit_grant_link SET expires_at = now() - interval '1 day' WHERE id = '${linkId}';`
  );
}

// ─── scenario ───────────────────────────────────────────────────────────────

export async function seedCreditGrantLinks(): Promise<SeededState> {
  const adminViewer = createUser({ name: 'Admin', lastName: 'Viewer' });
  const alice = createUser({ name: 'Alice', lastName: 'Claimer' });
  const bob = createUser({ name: 'Bob', lastName: 'Claimer' });
  const carol = createUser({ name: 'Carol', lastName: 'Claimer' });
  const dave = createUser({ name: 'Dave', lastName: 'Claimer' });
  const eve = createUser({ name: 'Eve', lastName: 'Claimer' });

  for (const u of [adminViewer, alice, bob, carol, dave, eve]) {
    createEmailLogin({ userId: u.id });
  }

  // The admin links page requires the viewer to be an Owner/Admin of the "Unify" org
  const unifyOrg = createOrg({ name: 'Unify', ownerId: adminViewer.id });

  // 1. Active single-use (unclaimed)
  await createLink(7, 10, 1, 'Direct invite — John');

  // 2. Claimed single-use
  const claimed = await createLink(7, 15, 1, 'Welcome bonus — Alice');
  await claimLink(claimed.token, alice.apiKey);

  // 3. Expired unclaimed single-use (no name — tests unnamed links)
  const expiredUnclaimed = await createLink(7, 10, 1);
  expireLink(expiredUnclaimed.id);

  // 4. Active multi-use (max_claims=5, unclaimed)
  await createLink(30, 20, 5, 'Twitter campaign Q2');

  // 5. Partially claimed multi-use (2 of 5 claimed)
  const partial = await createLink(30, 25, 5, 'Discord giveaway');
  await claimLink(partial.token, bob.apiKey);
  await claimLink(partial.token, carol.apiKey);

  // 6. Exhausted multi-use (3 of 3 claimed)
  const exhausted = await createLink(30, 10, 3, 'Partner referral — Acme');
  await claimLink(exhausted.token, dave.apiKey);
  await claimLink(exhausted.token, eve.apiKey);
  const extra = createUser({ name: 'Extra', lastName: 'Claimer' });
  await claimLink(exhausted.token, extra.apiKey);

  // 7. Expired multi-use with partial claims (1 of 3)
  const expiredPartial = await createLink(7, 30, 3, 'Conference booth');
  const expiredClaimer = createUser({ name: 'Expired', lastName: 'Claimer' });
  await claimLink(expiredPartial.token, expiredClaimer.apiKey);
  expireLink(expiredPartial.id);

  // 8. Large budget link (max_claims=50, 1 claimed)
  const largeBudget = await createLink(90, 5, 50, 'Newsletter signup offer');
  const largeClaimer = createUser({ name: 'Large', lastName: 'Claimer' });
  await claimLink(largeBudget.token, largeClaimer.apiKey);

  return {
    users: { admin_viewer: adminViewer, alice, bob, carol, dave, eve },
    org: unifyOrg,
    assistants: [],
    credentials: {
      admin_viewer: {
        email: adminViewer.email,
        password: 'testpass123',
        apiKey: unifyOrg.ownerOrgApiKey,
        userId: adminViewer.id,
      },
      alice: {
        email: alice.email,
        password: 'testpass123',
        apiKey: alice.apiKey,
        userId: alice.id,
      },
      bob: {
        email: bob.email,
        password: 'testpass123',
        apiKey: bob.apiKey,
        userId: bob.id,
      },
      carol: {
        email: carol.email,
        password: 'testpass123',
        apiKey: carol.apiKey,
        userId: carol.id,
      },
      dave: {
        email: dave.email,
        password: 'testpass123',
        apiKey: dave.apiKey,
        userId: dave.id,
      },
      eve: {
        email: eve.email,
        password: 'testpass123',
        apiKey: eve.apiKey,
        userId: eve.id,
      },
    },
  };
}
