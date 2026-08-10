# Area Priority (Phase 9b)

Business criticality map for Console E2E. **Area priority sets coverage floors and CI sampling** — it does not mean every test in a P0 file is high quality. See [CI_TESTING.md](./CI_TESTING.md) for the two-axis model and [ADDING_E2E_TESTS.md](./ADDING_E2E_TESTS.md) when adding tests.

## Priority levels

| Priority | Meaning                                            | CI on push                             | CI on PR                                        | Constraint                                                            |
| -------- | -------------------------------------------------- | -------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------- |
| **P0**   | Revenue, auth, access, workspace integrity         | Subset tagged `@push` (platform entry) | 100% of `@critical` tests (no random exclusion) | No spec file deletes; meet minimum journey floor after per-test sweep |
| **P1**   | Referrals, grants, metered, org RBAC, usage ledger | —                                      | ≥85% non-critical sample + all `@critical`      | Keep spec files; floor enforced                                       |
| **P2**   | Chat, call, dashboards, coordinator                | Minimum chat `@push` only where tagged | ~65% non-critical sample                        | Files may merge                                                       |
| **P3**   | Layout, chrome, deprecated UX                      | —                                      | 0% sample (exhaustive only)                     | May drop E2E entirely                                                 |

Sampling rates and shards: [`scripts/ci-playwright-manifest.json`](../../scripts/ci-playwright-manifest.json). Enforced by [`scripts/check-test-coverage-map.ts`](../../scripts/check-test-coverage-map.ts).

## P0 areas

| Area ID                | Surface                          | Spec files                                               | Minimum `@critical` journeys                                                                        |
| ---------------------- | -------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `auth.core`            | Login, session, signup, password | `auth/login`, `signup`, `session`, `password-management` | Valid login; invalid creds; signup→verify→onboard; session invalidation; password change + re-login |
| `auth.mfa`             | MFA                              | `auth/mfa-login`, `mfa-profile`                          | TOTP login; invalid TOTP; MFA setup; MFA disable                                                    |
| `billing.wallet`       | Credits, guard, banners          | `billing/balance`, `billable-action-guard`, `banners`    | UI↔DB balance; guard at zero; OOC banner; guard with credits; metered bypass                        |
| `billing.subscription` | Tier lifecycle                   | `billing/subscription-billing`, `subscribe`              | Subscribe; tier change; cancel; delinquency banners                                                 |
| `billing.access`       | Billing auth                     | `billing/access-control`                                 | Unauthenticated redirect; billing page loads                                                        |
| `workspace`            | Org/personal context             | `account/workspace-context`, `teams`                     | API keys; org billing balance; team lifecycle + DB                                                  |
| `assistants.core`      | Shell, list, hire                | `assistants/shell`, `list`, `shell/push-gate`            | Rail boot; switcher; hire/onboard; list selection                                                   |
| `admin.impersonation`  | View-as                          | `impersonation/view-as`                                  | View-as + return                                                                                    |

## P1 areas

| Area ID                       | Surface          | Spec files                        | Minimum `@critical` journeys                                  |
| ----------------------------- | ---------------- | --------------------------------- | ------------------------------------------------------------- |
| `billing.referrals`           | Referrals        | `billing/referrals`               | Link/code; attribution; self-referral block; dashboard reward |
| `billing.credit-grants`       | Grant links      | `billing/credit-grants`           | Claim UI; DB credits; invalid token; double-claim             |
| `billing.auto-increment`      | Auto tier bump   | `billing/auto-increment`          | Toggle↔API; top-tier note                                     |
| `billing.metered`             | Managed billing  | `billing/metered-billing`         | METERED card; no self-serve UI; invoices                      |
| `billing.usage`               | Usage ledger     | `billing/usage`                   | Ledger categories; auth redirect                              |
| `billing.events`              | Billing SSE      | `billing/billing-events`          | Push→SSE roundtrip (if stable)                                |
| `billing.manual-topup`        | Dev top-up       | `billing/manual-topup`            | Top-up→DB (when mode active)                                  |
| `billing.api-parity`          | API↔UI           | `billing/billing-api`             | Balance parity                                                |
| `account.security`            | API keys         | `account/api-key`                 | Mask; regenerate + DB                                         |
| `account.profile`             | Profile          | `account/profile`                 | Auto-save + reload                                            |
| `account.contact`             | Contact          | `account/contact-info`            | Verify/persist E.164; hydration                               |
| `account.org`                 | Org RBAC         | `account/roles`, `org-management` | Roles; members; settings                                      |
| `assistants.permissions`      | Role boundaries  | `assistants/permissions`          | Member denied; admin allowed                                  |
| `assistants.billing-adjacent` | Spending limits  | `account/spending-limits`         | Limit editor persists                                         |
| `admin.billing-plans`         | Admin templates  | `admin/billing-plans`             | Create template; assign org                                   |
| `auth.invite`                 | Invites          | `auth/invite`                     | Accept + DB                                                   |
| `auth.recovery`               | Password reset   | `auth/forgot-password`            | Request + complete                                            |
| `auth.deletion`               | Account deletion | `auth/account-deletion`           | Session invalidated                                           |

## P2 areas

| Area ID                   | Specs                                                                                            | Notes                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------- |
| `assistants.chat`         | `chat`, `chat-attachments` → `chat.journey`                                                      | Send, attachment, DB                    |
| `assistants.chat.stream`  | `chat-stream`                                                                                    | Long-pole Pub/Sub                       |
| `assistants.call`         | `call`                                                                                           | Dev-stub connect/end                    |
| `assistants.contacts`     | `contacts`                                                                                       | Create + delete                         |
| `assistants.live-actions` | `live-actions`                                                                                   | Historical + live push                  |
| `assistants.edit`         | `edit`, `delete`, `voice`                                                                        | Profile/voice DB                        |
| `assistants.coordinator`  | `coordinator-onboarding`, `onboarding`, `coordinator-sidebar`                                    | Coordinator journeys + sidebar ordering |
| `assistants.data`         | `dashboards`, `tasks`, `data-bridge`, `desktop-link`, `workspace-file-access`, `desktop-filesys` | Smokes + filesystem consent             |
| `assistants.chat-search`  | `chat-search`                                                                                    | Search dialog + shared-root navigation  |
| `assistants.call-pose`    | `call-working-pose`                                                                              | In-call pose state machine              |
| `assistants.embed`        | `embed`                                                                                          | Embed parsing/rendering                 |
| `assistants.brain`        | `brain`                                                                                          | Rail brain sections and navigation      |
| `billing.profile-ui`      | `billing/profile`                                                                                | Save name persists                      |

## P1 areas (continued — medium-high product surfaces)

| Area ID                   | Surface                    | Spec files                                         | Minimum `@critical` journeys                |
| ------------------------- | -------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `account.support`         | Support tickets            | `account/support-ticket`                           | Dialog lifecycle + submission               |
| `account.reset`           | Account reset              | `account/reset-account`                            | Reset flow when mode active                 |
| `assistants.integrations` | Provider + workspace cards | `provider-integrations`, `workspace-provider-card` | Profile deep-link; provider card visibility |
| `assistants.workflows`    | Curated workflows shelf    | `workflows`                                        | Shelf install/uninstall journey             |

## P3 areas (may leave E2E)

| Area ID            | Specs                                          |
| ------------------ | ---------------------------------------------- |
| `ux.timezone`      | `timezone-sync`                                |
| `ux.layout`        | `responsive-drawer-layout`, list resize pixels |
| `ux.media-stubs`   | `photo-video`                                  |
| `ux.list-grouping` | `list-grouping`                                |

P0/P1 area IDs cannot be removed from [TEST_COVERAGE_MAP.md](./TEST_COVERAGE_MAP.md) without explicit deprecation sign-off.
