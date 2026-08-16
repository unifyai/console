# Console Test Inventory

Per-test audit log for area-first CI. See [CI_TESTING.md](./CI_TESTING.md) and [AREA_PRIORITY.md](./AREA_PRIORITY.md).

**Full per-test rows:** [TEST_INVENTORY.generated.md](./TEST_INVENTORY.generated.md) (regenerate with `npx tsx scripts/generate-e2e-inventory.ts`).

Legend: **keep** · **delete** · **`@push`** = runs every branch push · **`@critical`** = always runs on PR Gate sampling

## Push Gate (`push-gate`)

Platform-entry blockers: login → shell → routes → list → chat → billing guard. All `@push` tests run on every push (~18 tests).

| File                                    | Tier | Verdict | Notes                                 |
| --------------------------------------- | ---- | ------- | ------------------------------------- |
| `auth/login.e2e.ts`                     | push | keep    | 1 `@push` valid login                 |
| `auth/session.e2e.ts`                   | push | keep    | 1 `@push` stale session signout       |
| `shell/push-gate.e2e.ts`                | push | keep    | Rail + switcher `@push`               |
| `shell/route-shell-smoke.e2e.ts`        | push | keep    | `/favourites` + `/interfaces` `@push` |
| `shell/unified-shell-navigation.e2e.ts` | push | keep    | No-reload unified shell nav `@push`   |
| `assistants/shell.e2e.ts`               | push | keep    | Unity switcher `@push`                |
| `assistants/list.e2e.ts`                | push | keep    | Onboard + seeded list `@push`         |
| `assistants/chat.e2e.ts`                | push | keep    | Send message `@push`                  |
| `assistants/floating-chat.e2e.ts`       | push | keep    | Settings floater `@push`              |
| `assistants/reactions.e2e.ts`           | push | keep    | Chat reactions `@push`                |
| `billing/billable-action-guard.e2e.ts`  | push | keep    | Enabled with credits `@push`          |
| `billing/access-control.e2e.ts`         | push | keep    | Billing page sections `@push`         |
| `account/workspace-context.e2e.ts`      | push | keep    | Org workspace balance `@push`         |

## PR Gate — Billing (`pr-billing`, 14 files, 3 shards)

| File                           | Area                   | Verdict | @critical keepers                                   |
| ------------------------------ | ---------------------- | ------- | --------------------------------------------------- |
| `access-control.e2e.ts`        | billing.access         | keep    | redirect + page sections                            |
| `balance.e2e.ts`               | billing.wallet         | merged  | 1 UI↔DB + reload @critical                          |
| `banners.e2e.ts`               | billing.wallet         | merged  | 3 tests: OOC threshold + metered bypass + suspended |
| `billable-action-guard.e2e.ts` | billing.wallet         | keep    | block / enable / metered bypass                     |
| `subscription-billing.e2e.ts`  | billing.subscription   | trimmed | monthly, tier change, cancel, PAST_DUE @critical    |
| `subscribe.e2e.ts`             | billing.subscription   | keep    | 1 subscribed UI @critical                           |
| `credit-grants.e2e.ts`         | billing.credit-grants  | trimmed | 4 @critical (API 401/404 deleted)                   |
| `referrals.e2e.ts`             | billing.referrals      | trimmed | 5 UI journeys; auth-401 API test deleted            |
| `auto-increment.e2e.ts`        | billing.auto-increment | trimmed | 1 toggle↔API @critical                              |
| `metered-billing.e2e.ts`       | billing.metered        | merged  | plan card + hide credits merged; 3 tests            |
| `usage.e2e.ts`                 | billing.usage          | trimmed | ledger + auth redirect only                         |
| `billing-api.e2e.ts`           | billing.api-parity     | keep    | 1–2 parity tests                                    |
| `billing-events.e2e.ts`        | billing.events         | keep    | SSE roundtrip                                       |
| `manual-topup.e2e.ts`          | billing.manual-topup   | keep    | env-gated skip OK                                   |

## PR Gate — Account (`pr-account`)

| File                       | Area                        | Verdict | Notes                                                 |
| -------------------------- | --------------------------- | ------- | ----------------------------------------------------- |
| `profile.e2e.ts`           | account.profile             | keep    | auto-save                                             |
| `api-key.e2e.ts`           | account.security            | keep    | mask + regenerate                                     |
| `contact-info.e2e.ts`      | account.contact             | keep    | E.164                                                 |
| `workspace-context.e2e.ts` | workspace                   | merged  | API keys + org balance @critical; cookie tests merged |
| `teams.e2e.ts`             | workspace                   | merged  | 1 CRUD lifecycle @critical + sharing tests            |
| `roles.e2e.ts`             | account.org                 | keep    | role lifecycle                                        |
| `org-management.e2e.ts`    | account.org                 | keep    | members + settings                                    |
| `spending-limits.e2e.ts`   | assistants.billing-adjacent | keep    | limit editor                                          |

**Removed from PR:** `timezone-sync` only (P3)

## PR Gate — Assistants (`pr-assistants`)

| File                            | Area                    | Verdict | Notes                                                      |
| ------------------------------- | ----------------------- | ------- | ---------------------------------------------------------- |
| `shell.e2e.ts`                  | assistants.core         | trimmed | rail + switcher @critical; account menu + collapse deleted |
| `list.e2e.ts`                   | assistants.core         | trimmed | 3 @critical                                                |
| `rail-pinning.e2e.ts`           | assistants.core         | keep    | P0 default-pinned @critical; pin/unpin, More, customize    |
| `live-actions.e2e.ts`           | assistants.live-actions | trimmed | historical + live @critical                                |
| `permissions.e2e.ts`            | assistants.permissions  | keep    | RBAC boundaries                                            |
| `coordinator-onboarding.e2e.ts` | assistants.coordinator  | keep    | picker gate + checklist journeys                           |

## PR Gate — Auth (`pr-auth`)

All auth PR specs kept; login trimmed to 4 @critical; signup trimmed (whitespace/switch deleted).

## PR Gate — Shell & Admin (`pr-shell-admin`)

| File                                    | Verdict |
| --------------------------------------- | ------- |
| `shell/route-shell-smoke.e2e.ts`        | keep    |
| `shell/unified-shell-navigation.e2e.ts` | keep    |
| `admin/billing-plans.e2e.ts`            | keep    |
| `impersonation/view-as.e2e.ts`          | keep    |

## Exhaustive-only (P1/P2 — kept, not on PR lists)

Medium–high priority specs retained for full `[run-tests]` matrix:

| File                                        | Area priority | Notes                                                     |
| ------------------------------------------- | ------------- | --------------------------------------------------------- |
| `account/support-ticket.e2e.ts`             | P1            | Support dialog lifecycle                                  |
| `account/reset-account.e2e.ts`              | P1            | Reset flow (env-gated)                                    |
| `assistants/chat-search.e2e.ts`             | P2            | Search + shared-root                                      |
| `assistants/brain.e2e.ts`                   | P2            | Rail brain sections                                       |
| `assistants/call-working-pose.e2e.ts`       | P2            | In-call pose states                                       |
| `assistants/coordinator-sidebar.e2e.ts`     | P2            | Coordinator sidebar ordering                              |
| `assistants/desktop-filesys.e2e.ts`         | P2            | Filesystem consent                                        |
| `assistants/chat.e2e.ts`                    | P2            | 4 tests: send, history+order, shared-root, credits guard  |
| `assistants/chat-stream.e2e.ts`             | P2            | 9 tests (was 14): unread badge merged, tab title deleted  |
| `assistants/data-bridge.e2e.ts`             | P2            | 6 tests (was 15): routing merged, proxy-400 batch deleted |
| `assistants/contacts.e2e.ts`                | P2            | 8 tests (was 12)                                          |
| `assistants/call.e2e.ts`                    | P2            | 8 tests (was 13)                                          |
| `assistants/tasks.e2e.ts`                   | P2            | 8 tests (was 13)                                          |
| `assistants/hire.e2e.ts`                    | P2            | 4 tests (was 7)                                           |
| `assistants/embed.e2e.ts`                   | P2            | 4 tests: merged URL types, expand @critical               |
| `assistants/provider-integrations.e2e.ts`   | P1            | Provider integrations                                     |
| `assistants/workspace-provider-card.e2e.ts` | P1            | Workspace provider card                                   |
| `assistants/workflows.e2e.ts`               | P1            | Workflows shelf: install journey + held connection        |

Their `@critical` tags mark the coverage floor that `test-registry.ts` enforces by
title; they do not select anything on PR Gate, which samples only within the tier
file lists. A P0 journey may not sit here — see [CI_TESTING.md](./CI_TESTING.md).

## P3 deleted

`timezone-sync`, `list-grouping`, `photo-video`, `responsive-drawer-layout`

## Exhaustive discovery

All remaining `src/tests/**/*.e2e.ts` files auto-discovered by `find` in exhaustive tiers.
