# Test Coverage Map

Capability registry enforced by `npm run check:test-coverage`. Source of truth for matchers: [`test-registry.ts`](./test-registry.ts).

## P0 areas

| Area ID                | Capabilities (title substring)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `auth.core`            | completes login with valid credentials; shows error for invalid password; shows error when email is not registered; shows provider conflict; completes full registration; requires how-did-you-hear before workspace setup; selects personal workspace and redirects                                                                                                                                                                                                                                                     |
| `auth.mfa`             | completes TOTP verification; shows error for invalid TOTP code; completes full MFA setup; disables 2FA with a valid TOTP code                                                                                                                                                                                                                                                                                                                                                                                            |
| `billing.wallet`       | shows credit balance on the billing page matching the DB; blocks the onboard CTA when user has no credits; buttons are enabled when user has credits; shows out-of-credits banner when balance is negative                                                                                                                                                                                                                                                                                                               |
| `billing.subscription` | subscribed account shows current tier; changing tier keeps a confirm dialog; cancel keeps access until period end; PAST_DUE shows a soft banner                                                                                                                                                                                                                                                                                                                                                                          |
| `billing.access`       | billing page redirects unauthenticated users to login; billing page shows all main sections                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `workspace`            | personal and org workspaces expose distinct API keys; switching to org workspace returns org billing balance; creating a team via UI adds it to the database                                                                                                                                                                                                                                                                                                                                                             |
| `assistants.core`      | rail renders with brand and unity switcher; list updates after hiring; Onboard button opens the hire dialog; clicking an assistant in the list selects it; unified shell navigation preserves assistant state; every section is pinned by default; unpinning a section moves it behind More and survives a reload; a hidden section can be re-pinned from the More menu; the customize editor toggles a section; a section absent from a stored config stays pinned; the folded dock reaches the overflow and the editor |
| `admin.impersonation`  | Unify member can view as another user and return                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

## P1 areas

| Area ID                  | Capabilities                                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `billing.referrals`      | referral link and code; attributes a referred friend; blocks self-referral; referrer dashboard reflects a rewarded referral |
| `billing.credit-grants`  | claims a credit grant link; non-existent token; already-claimed message; max_claims=1 rejects second user                   |
| `billing.usage`          | ledger displays seeded transactions; redirects to login when not authenticated                                              |
| `account.security`       | Security tab masks the API key; regenerating API key produces a new key in the database                                     |
| `account.profile`        | auto-saved profile name persists after page reload                                                                          |
| `account.org`            | (roles + org-management specs — see inventory)                                                                              |
| `assistants.permissions` | (permissions.e2e.ts — see inventory)                                                                                        |
| `admin.billing-plans`    | billing plans page creates a BESPOKE template; organizations page sets the new template                                     |

## P2 areas (exhaustive tier — medium-high)

| Area ID                             | Spec files                          |
| ----------------------------------- | ----------------------------------- |
| `assistants.chat-search`            | `chat-search`                       |
| `assistants.brain`                  | `brain`                             |
| `assistants.call-pose`              | `call-working-pose`                 |
| `assistants.coordinator`            | `coordinator-sidebar`, `onboarding` |
| `assistants.coordinator-onboarding` | `coordinator-onboarding`            |
| `assistants.desktop`                | `desktop-filesys`                   |
| `assistants.embed`                  | `embed`                             |

## P1 areas (exhaustive tier — account + integrations)

| Area ID                   | Spec files                                         |
| ------------------------- | -------------------------------------------------- |
| `account.support`         | `support-ticket`                                   |
| `account.reset`           | `reset-account`                                    |
| `assistants.integrations` | `provider-integrations`, `workspace-provider-card` |
| `assistants.workflows`    | `workflows`                                        |

## P3 removed

These spec files were deleted:

`timezone-sync`, `list-grouping`, `photo-video`, `responsive-drawer-layout`
