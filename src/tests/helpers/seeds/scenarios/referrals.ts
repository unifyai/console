/**
 * Seed Scenario: Referrals
 *
 * Sets up the full cast for exercising the "Refer & earn" journeys end to
 * end — both personal and organization referral programs, plus pre-built
 * attributions in every status so the referrer dashboard has something to
 * render immediately.
 *
 * **What it creates:**
 *   - `referrer`        — personal referrer (owns a personal referral code)
 *   - `orgOwner` + "Refer Org" — an org that runs its own referral program
 *     (owns an org-scoped code whose rewards land on the org balance)
 *   - `pendingFriend`   — signed up via `referrer`'s code, not yet paid
 *                         (real attribution via the API → status `pending`)
 *   - `orgPendingFriend`— signed up via the org code, not yet paid (so the
 *                         org dashboard's "Signed up" count is non-zero)
 *   - `rewardedFriend`  — friend whose first payment already cleared
 *                         (seeded `rewarded` row → shows earned credits)
 *   - `reversedFriend`  — friend whose payment was refunded
 *                         (seeded `reversed` row → clawback display)
 *   - `orgRewardedFriend` — rewarded against the org code (org earnings)
 *   - `freshFriend`     — brand-new user with NO attribution yet, for
 *                         walking the live `?ref=` capture journey manually
 *
 * **Credentials (all password `testpass123`):**
 *   - `referrer`   — log in here to see the personal Refer & earn dashboard
 *   - `orgOwner`   — switch to "Refer Org" workspace to see org earnings
 *   - `freshFriend`— log in (or sign up fresh) to test attribution via a link
 *
 * The reward/clawback rows are seeded directly (those transitions are
 * webhook-driven and covered by the Orchestra `test_billing` suite). The
 * *attribution* journeys below use the real API so you can verify the
 * guards live.
 */

import type { SeededState } from '../types';
import {
  createUser,
  createOrg,
  createEmailLogin,
  orchestraFetch,
  dbExec,
  dbExecBlock,
  seedCoordinatorChatForUsers,
} from '../client';

// ─── helpers ────────────────────────────────────────────────────────────────

/** Mint + return a user's primary referral code via the real endpoint. */
async function mintReferralCode(apiKey: string): Promise<string> {
  const res = await orchestraFetch('/v0/user/referral', { method: 'GET' }, apiKey);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to mint referral code: ${res.status} ${text}`);
  }
  const data = (await res.json()) as { code: string };
  return data.code;
}

/** Apply a referral code to a (new) user via the real attribution endpoint. */
async function attribute(code: string, userApiKey: string): Promise<void> {
  const res = await orchestraFetch(
    '/v0/user/referral/attribute',
    { method: 'POST', body: JSON.stringify({ code }) },
    userApiKey
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to attribute referral: ${res.status} ${text}`);
  }
}

function billingAccountId(userId: string): number {
  return parseInt(dbExec(`SELECT billing_account_id FROM "user" WHERE id = '${userId}'`), 10);
}

/**
 * Seed a completed (rewarded or reversed) referral attribution directly —
 * the post-webhook state. `orgId` populates the org-scoped reward path.
 */
function seedAttributionRow(opts: {
  code: string;
  referrerUserId: string;
  refereeUserId: string;
  status: 'rewarded' | 'reversed';
  rewardUsd: number;
  bonusUsd: number;
  orgId?: number;
}): void {
  const referrerBa = opts.orgId
    ? parseInt(dbExec(`SELECT billing_account_id FROM organization WHERE id = ${opts.orgId}`), 10)
    : billingAccountId(opts.referrerUserId);
  const refereeBa = billingAccountId(opts.refereeUserId);
  const orgCol = opts.orgId != null ? `${opts.orgId}` : 'NULL';
  const reversedAt = opts.status === 'reversed' ? 'NOW()' : 'NULL';

  dbExecBlock(`
DO \\$\\$
BEGIN
  INSERT INTO referral_attribution
    (id, code, referrer_user_id, referrer_organization_id, referee_user_id,
     referee_billing_account_id, referrer_billing_account_id, status,
     created_at, rewarded_at, reversed_at, first_payment_invoice_id,
     reward_amount, referee_bonus_amount)
  VALUES
    (gen_random_uuid()::text, '${opts.code}', '${opts.referrerUserId}', ${orgCol},
     '${opts.refereeUserId}', ${refereeBa}, ${referrerBa}, '${opts.status}',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 days', ${reversedAt},
     'in_seed_${opts.refereeUserId.slice(0, 8)}', ${opts.rewardUsd}, ${opts.bonusUsd})
  ON CONFLICT (referee_user_id) DO NOTHING;
END
\\$\\$;
`);
}

// ─── scenario ───────────────────────────────────────────────────────────────

export async function seedReferrals(): Promise<SeededState> {
  // Cast
  const referrer = createUser({ name: 'Rachel', lastName: 'Referrer' });
  const orgOwner = createUser({ name: 'Olivia', lastName: 'OrgOwner' });
  const pendingFriend = createUser({ name: 'Pat', lastName: 'Pending' });
  const orgPendingFriend = createUser({ name: 'Paula', lastName: 'OrgPending' });
  const rewardedFriend = createUser({ name: 'Riley', lastName: 'Rewarded' });
  const reversedFriend = createUser({ name: 'Robin', lastName: 'Reversed' });
  const orgRewardedFriend = createUser({ name: 'Omar', lastName: 'OrgRewarded' });
  const freshFriend = createUser({ name: 'Fred', lastName: 'Fresh' });

  for (const u of [
    referrer,
    orgOwner,
    pendingFriend,
    orgPendingFriend,
    rewardedFriend,
    reversedFriend,
    orgRewardedFriend,
    freshFriend,
  ]) {
    createEmailLogin({ userId: u.id });
  }

  // Org that runs its own referral program (org-scoped code → org earnings).
  const referOrg = createOrg({ name: 'Refer Org', ownerId: orgOwner.id });

  // Personal + org referral codes (minted through the real endpoint; the
  // org-scoped code is minted with the org API key so it carries org context).
  const personalCode = await mintReferralCode(referrer.apiKey);
  const orgCode = await mintReferralCode(referOrg.ownerOrgApiKey);

  // Live, real attributions (status = pending) — the friends used a link but
  // haven't paid yet. One on the personal code, one on the org code so both
  // the personal and the org-wide dashboards show a non-zero "Signed up".
  await attribute(personalCode, pendingFriend.apiKey);
  await attribute(orgCode, orgPendingFriend.apiKey);

  // Seeded completed states for the personal referrer's dashboard.
  seedAttributionRow({
    code: personalCode,
    referrerUserId: referrer.id,
    refereeUserId: rewardedFriend.id,
    status: 'rewarded',
    rewardUsd: 15,
    bonusUsd: 10,
  });
  seedAttributionRow({
    code: personalCode,
    referrerUserId: referrer.id,
    refereeUserId: reversedFriend.id,
    status: 'reversed',
    rewardUsd: 12,
    bonusUsd: 10,
  });

  // Seeded rewarded state for the org program (credited to the org balance).
  seedAttributionRow({
    code: orgCode,
    referrerUserId: orgOwner.id,
    refereeUserId: orgRewardedFriend.id,
    status: 'rewarded',
    rewardUsd: 25,
    bonusUsd: 10,
    orgId: referOrg.id,
  });

  await seedCoordinatorChatForUsers([referrer, orgOwner, freshFriend]);

  // Surface the codes in the runner output for convenience.
  console.log(`   Personal referral code: ${personalCode}`);
  console.log(`   Org referral code:      ${orgCode}`);
  console.log(`   Personal link: http://localhost:3000/login?ref=${personalCode}`);
  console.log(`   Org link:      http://localhost:3000/login?ref=${orgCode}`);

  return {
    users: {
      referrer,
      orgOwner,
      pendingFriend,
      orgPendingFriend,
      rewardedFriend,
      reversedFriend,
      orgRewardedFriend,
      freshFriend,
    },
    org: referOrg,
    assistants: [],
    credentials: {
      referrer: {
        email: referrer.email,
        password: 'testpass123',
        apiKey: referrer.apiKey,
        userId: referrer.id,
      },
      orgOwner: {
        email: orgOwner.email,
        password: 'testpass123',
        apiKey: referOrg.ownerOrgApiKey,
        userId: orgOwner.id,
      },
      freshFriend: {
        email: freshFriend.email,
        password: 'testpass123',
        apiKey: freshFriend.apiKey,
        userId: freshFriend.id,
      },
    },
  };
}
