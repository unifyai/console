# Console Test Inventory

Per-file audit for Phase 9. Classifications: **keep**, **rewrite**, **delete**. CI tiers: **push**, **pr**, **full**.

Legend: ✅ keep · 🔧 rewritten this sweep · 🗑 deleted

## Push Gate

| File                             | Tier | Status                            |
| -------------------------------- | ---- | --------------------------------- |
| `auth/login.e2e.ts`              | push | ✅                                |
| `shell/route-shell-smoke.e2e.ts` | push | 🔧 removed screenshots            |
| `shell/push-gate.e2e.ts`         | push | 🔧 extracted from shell `-g` hack |

## Assistants (29 E2E)

| File                            | Tier    | Status | Notes                                            |
| ------------------------------- | ------- | ------ | ------------------------------------------------ |
| `shell.e2e.ts`                  | push/pr | ✅     | Rail, sections, mobile, collapse                 |
| `list.e2e.ts`                   | push/pr | 🔧     | Absorbed profile.e2e deep-link + menu tests      |
| `delete.e2e.ts`                 | full    | ✅     | Destructive-path smoke                           |
| `contacts.e2e.ts`               | pr      | 🔧     | Deterministic assistants, no conditional skips   |
| `chat.e2e.ts`                   | full    | 🔧     | Removed fixed sleeps; stable chat-area waits     |
| `chat-stream.e2e.ts`            | full    | ✅     | Long-pole Pub/Sub suite (timing tied to stream)  |
| `chat-search.e2e.ts`            | full    | ✅     | Search dialog + shared-root                      |
| `chat-attachments.e2e.ts`       | pr      | ✅     | Attachment guards + spending gate                |
| `live-actions.e2e.ts`           | pr/full | ✅     | Historical + live push                           |
| `brain.e2e.ts`                  | pr/full | ✅     | Rail brain sections                              |
| `call.e2e.ts`                   | pr/full | 🔧     | Strict connected-state asserts; no early pass    |
| `call-working-pose.e2e.ts`      | pr      | ✅     | Pose state machine                               |
| `voice.e2e.ts`                  | full    | 🔧     | Stable `voice-option-*` + exact DB voice_id      |
| `hire.e2e.ts`                   | full    | 🔧     | Removed cross-test-dependent case                |
| `edit.e2e.ts`                   | pr/full | ✅     | Profile + voice DB persistence                   |
| `onboarding.e2e.ts`             | full    | ✅     | Roadmap + step gating                            |
| `coordinator-onboarding.e2e.ts` | full    | ✅     | Serial coordinator picker lifecycle              |
| `coordinator-sidebar.e2e.ts`    | full    | ✅     | Role + pinned ordering                           |
| `list-grouping.e2e.ts`          | full    | ✅     | Team grouping semantics                          |
| `permissions.e2e.ts`            | full    | 🔧     | Rail-visible waits; removed dialog sleeps        |
| `dashboards.e2e.ts`             | full    | ✅     | Seeded dashboard tiles                           |
| `tasks.e2e.ts`                  | full    | ✅     | Task cards + filters                             |
| `provider-integrations.e2e.ts`  | full    | 🔧     | Profile deep-link; no onboarding bypass branches |
| `workspace-file-access.e2e.ts`  | pr      | ✅     | Filesystem policy DB check                       |
| `desktop-link.e2e.ts`           | pr/full | ✅     | Desktop link lifecycle                           |
| `desktop-filesys.e2e.ts`        | pr      | ✅     | Filesystem consent                               |
| `photo-video.e2e.ts`            | full    | 🔧     | Stale `Hire Assistant` → `Onboard Teammate`      |
| `embed.e2e.ts`                  | full    | ✅     | Embed parsing/rendering                          |
| `data-bridge.e2e.ts`            | full    | ✅     | Bridge routing contract                          |
| `profile.e2e.ts`                | —       | 🗑     | Duplicative with list/shell — merged into list   |

## Billing (14 E2E)

| File                           | Tier | Status | Notes                              |
| ------------------------------ | ---- | ------ | ---------------------------------- |
| `access-control.e2e.ts`        | pr   | ✅     | Auth redirect + page load          |
| `balance.e2e.ts`               | pr   | 🔧     | Exact UI↔DB credit label           |
| `usage.e2e.ts`                 | pr   | 🔧     | Ledger/chart visibility waits      |
| `banners.e2e.ts`               | pr   | ✅     | Zero/negative/metered banners      |
| `billable-action-guard.e2e.ts` | pr   | 🔧     | Targets onboard CTA + guard testid |
| `subscription-billing.e2e.ts`  | full | ✅     | Self-serve lifecycle               |
| `metered-billing.e2e.ts`       | full | ✅     | METERED mode UI                    |
| `manual-topup.e2e.ts`          | full | ✅     | Mode-gated (env skip intentional)  |
| `subscribe.e2e.ts`             | full | 🔧     | API contract + subscribed UI meter |
| `billing-api.e2e.ts`           | full | 🔧     | Balance API↔UI parity test         |
| `referrals.e2e.ts`             | full | 🔧     | Dashboard rewarded/earned stats    |
| `profile.e2e.ts`               | full | 🔧     | `billing-profile-section` testids  |
| `credit-grants.e2e.ts`         | full | 🔧     | API + `?token=` UI claim journey   |
| `billing-events.e2e.ts`        | full | 🔧     | Strict SSE + push roundtrip        |
| `auto-increment.e2e.ts`        | full | 🔧     | Subscribed toggle UI + API sync    |

## Auth (9 E2E)

| File                         | Tier    | Status | Notes                         |
| ---------------------------- | ------- | ------ | ----------------------------- |
| `login.e2e.ts`               | push/pr | ✅     | Core auth gate                |
| `signup.e2e.ts`              | pr      | ✅     | Full signup + DB invariants   |
| `session.e2e.ts`             | pr      | 🔧     | Removed login-duplicate block |
| `password-management.e2e.ts` | pr      | ✅     | Change + forced re-auth       |
| `mfa-login.e2e.ts`           | pr      | ✅     | Recovery skip env-gated       |
| `mfa-profile.e2e.ts`         | pr      | ✅     | Setup/disable/regenerate      |
| `invite.e2e.ts`              | full    | ✅     | Invite acceptance             |
| `forgot-password.e2e.ts`     | full    | ✅     | Reset flow                    |
| `account-deletion.e2e.ts`    | full    | 🔧     | Session invalidation + rail   |

## Account (11 E2E)

| File                       | Tier | Status | Notes                               |
| -------------------------- | ---- | ------ | ----------------------------------- |
| `profile.e2e.ts`           | pr   | ✅     | Auto-save + reload                  |
| `contact-info.e2e.ts`      | pr   | ✅     | E.164 + hydration                   |
| `api-key.e2e.ts`           | pr   | 🔧     | Masked key + reveal; regenerate API |
| `teams.e2e.ts`             | pr   | ✅     | Team CRUD                           |
| `roles.e2e.ts`             | pr   | ✅     | Role lifecycle                      |
| `org-management.e2e.ts`    | pr   | ✅     | Members + settings                  |
| `support-ticket.e2e.ts`    | pr   | ✅     | Dialog lifecycle                    |
| `timezone-sync.e2e.ts`     | pr   | ✅     | Context sync semantics              |
| `spending-limits.e2e.ts`   | pr   | 🔧     | Usage UI limit editor               |
| `workspace-context.e2e.ts` | pr   | 🔧     | Rail workspace switch + org balance |

## Shell / Admin / Impersonation

| File                             | Tier    | Status |
| -------------------------------- | ------- | ------ |
| `shell/route-shell-smoke.e2e.ts` | push/pr | 🔧     |
| `shell/push-gate.e2e.ts`         | push    | 🔧     |
| `admin/billing-plans.e2e.ts`     | pr/full | ✅     |
| `impersonation/view-as.e2e.ts`   | pr/full | ✅     |

## Vitest (Exhaustive only)

| Area                                    | Status | Notes                       |
| --------------------------------------- | ------ | --------------------------- |
| `_interfaces/**`                        | full   | 🔧 MSW via `@/tests/server` |
| `_visualization/**`                     | full   | Matrix/real suites          |
| `helpers/**/*.node.test.ts`             | full   | ✅ casing, chunkLoadReload  |
| `features/resolveFeatures.node.test.ts` | full   | ✅                          |
| `account/workspace.node.test.ts`        | full   | ✅                          |
| `assistants/*.node.test.ts`             | full   | ✅ route/proxy contracts    |
