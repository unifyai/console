# E2E Testing

Browser-based end-to-end tests that validate **complete user flows** through the real application. They launch Chromium, log in as a seeded user, interact with the UI exactly as a human would, and verify outcomes in both the **UI and the database**.

## Principles

- **User-flow oriented.** Each test file covers a feature area (hire, chat, edit, delete, permissions, etc.) and tests the flows a real user would perform — not individual components or API endpoints.
- **Real stack, no mocks.** Tests run against the local Console, Orchestra, and PostgreSQL. Server actions, API routes, and database writes execute for real. External services are stubbed at the infrastructure layer (see below), not in the test harness.
- **Seed before, verify after.** Test data (users, orgs, assistants) is created synchronously via direct SQL inserts and API calls _before_ the browser opens. After UI actions, assertions query the database to confirm persistence — not just that the UI updated.
- **One login per file.** Each test file creates a seeded user at module scope, logs in once via the browser, saves the session to a `storageState` file, and reuses it for every test in the file. This keeps tests fast without sacrificing realism.
- **Isolated and self-cleaning.** Each file's `afterAll` deletes all data it created (assistants, contacts, users, orgs). Tests within a file run serially and share state intentionally; different files are fully independent.

## Local Setup

> **This is the E2E dev/test harness, not the way to run the product.** To run
> the whole system locally, use **`unity stack up`** from the
> [unity repo](https://github.com/unifyai/unity) (see its
> [self-host docs](https://github.com/unifyai/unity/blob/staging/deploy/selfhost/README.md)).
> The seeded harness below exists for Console E2E tests.

E2E tests run against the full local stack. No cloud credentials, external API keys, or third-party services are required — the system automatically stubs everything that isn't available locally.

### Prerequisites

1. **Console + Orchestra + PostgreSQL** — start everything with `./scripts/local.sh start` in **this** repo (it brings up PostgreSQL, Orchestra in `ORCHESTRA_ENVIRONMENT=dev` with all external-service stubs active, seeds data, and Console). You do not need to start Orchestra or `npm run dev` separately. For internal full-product self-host development, use `unity-deploy/selfhost/stack.sh up` and the runbook at `unity-deploy/docs/local-full-stack-inner-loop.md` instead of starting repo pieces by hand.
2. **Docker** — required for PostgreSQL access (seed helpers use `docker exec psql`).

### How services are stubbed locally

The local setup uses a **credential-absence** pattern: when credentials or URLs for an external service are missing, the code falls back to a local stub automatically. No special flags or test-mode switches are needed.

| Service                                                  | What's missing locally                                         | What happens                                                                                                                                                       |
| -------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **GCS (file storage)**                                   | `GOOGLE_APPLICATION_CREDENTIALS`                               | Orchestra saves files to `/tmp/orchestra-media` and returns `localhost` URLs                                                                                       |
| **Pub/Sub (live actions)**                               | `COMMS_SERVICE_ACCOUNT_CREDENTIALS` and `PUBSUB_EMULATOR_HOST` | With the emulator (or GCP creds), Actions/billing SSE use Pub/Sub. Only when both are absent does Console fall back to the in-memory bus + `POST .../actions/push` |
| **LiveKit (calls)**                                      | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`         | Console returns `mode: "dev"` connection details; the call hook simulates a connected call without a real WebRTC connection                                        |
| **Replicate (photo/video)**                              | `REPLICATE_API_KEY`                                            | Orchestra returns placeholder image/video URLs                                                                                                                     |
| **Cartesia / ElevenLabs (voice)**                        | API keys                                                       | Orchestra returns stub voice IDs and silent WAV audio                                                                                                              |
| **Deepgram (transcription)**                             | `DEEPGRAM_API_KEY`                                             | Orchestra returns empty transcription results                                                                                                                      |
| **OpenAI (TTS)**                                         | —                                                              | Orchestra returns silent WAV for TTS calls in dev mode                                                                                                             |
| **Infrastructure (phone, email, pubsub topics, wakeup)** | Adapters/Comms URLs                                            | Orchestra returns stub responses for all provisioning operations                                                                                                   |

All Orchestra-side stubs are controlled by `settings.is_dev` (True when `ORCHESTRA_ENVIRONMENT=dev`). Console-side stubs are controlled by the absence of the relevant environment variables.

### Assistant test data

When creating test assistants via `createAssistant()`, the helper sets `is_local = true` in the database. This bypasses infrastructure provisioning (phone numbers, email accounts, pubsub topics, wakeup calls) that would otherwise fail or be unnecessary in a local environment.

## Architecture

```
src/tests/
  helpers/
    seeds/client.ts       Direct DB & API primitives (dbExec, createUser, createAssistant, ...)
    seeds/types.ts        TypeScript types for seeded entities
    e2e-helpers.ts        Playwright-specific helpers (createTestUser, cleanupUser, setUserCredits)
  auth/
    helpers.ts            Login flow helpers (fill email/password, handle onboarding)
  assistants/
    helpers.ts            Assistant-specific fixtures (createAssistantTest, openHireDialog, ...)
    hire.e2e.ts           Hire flow + pre-hire chat tests
    chat.e2e.ts           Chat messaging + attachment tests
    edit.e2e.ts           Edit assistant profile tests
    delete.e2e.ts         Delete assistant tests
    list.e2e.ts           Assistant list, deep link, menu tests
    call.e2e.ts           Voice/video call tests (dev-stubbed LiveKit)
    permissions.e2e.ts    Org role permission boundary tests
    contacts.e2e.ts       Contact management tests
    secrets.e2e.ts        Secrets manager tests
    voice.e2e.ts          Voice selection/cloning tests
    presets.e2e.ts        Preset assistant tests
    photo-video.e2e.ts    Photo/video generation tests
    live-actions.e2e.ts   Live actions viewer tests
  auth/
    login.e2e.ts          Login flow tests
    signup.e2e.ts         Signup flow tests
    session.e2e.ts        Session management tests
    ...                   MFA, password reset, account deletion, invites
```

### Quick start (local)

```bash
# One command — starts PostgreSQL, Orchestra, seeds, and Console:
./scripts/local.sh start

# Or with chat support (Pub/Sub emulator + local Unity gateway):
./scripts/local.sh start --chat
```

The `local.sh` script automatically:

- Aligns the sibling Orchestra checkout to match Console's branch (`main`→`main`, `staging`→`staging`, other branches→`staging`)
- Starts PostgreSQL (Docker) and Orchestra with `ORCHESTRA_ENVIRONMENT=dev`
- Generates seed data (users, assistants, orgs)
- Starts the Console dev server without cloud credentials (stubs activate)

For full local chat smoke tests, configure the local gateway first:

```bash
./scripts/local.sh gateway-setup
./scripts/local.sh gateway-doctor --check-credentials
./scripts/local.sh gateway-urls --public-url "$UNIFY_GATEWAY_PUBLIC_URL"
./scripts/local.sh start --chat --echo --seed personal-workspace-multi
```

`--echo` keeps the smoke independent of LLM/provider credentials. Real provider
channels still require provider accounts, API keys, and public HTTPS callback
URLs configured through the Unity gateway wizard.

See `./scripts/local.sh help` for all options.

## Running Tests

```bash
# All assistant E2E tests
npx playwright test src/tests/assistants/

# All auth E2E tests
npx playwright test src/tests/auth/

# Single file
npx playwright test src/tests/assistants/hire.e2e.ts

# Single test by name
npx playwright test src/tests/assistants/hire.e2e.ts -g "hiring an assistant persists"

# With UI mode (interactive debugging)
npx playwright test src/tests/assistants/ --ui
```

## CI Pipeline

E2E tests run in GitHub Actions via `.github/workflows/tests.yml` in three tiers:

| Tier           | Trigger                                                  | Jobs                                                                |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------- |
| **Push Gate**  | Every branch push (no marker)                            | Sampled smoke: login, route-shell, push-gate                        |
| **PR Gate**    | PRs targeting `staging` / `main`                         | Curated Assistants, Account, Billing (sharded), Auth, Shell & Admin |
| **Exhaustive** | `[run-tests]` in commit/PR title, or `workflow_dispatch` | Full Playwright matrix + Vitest node/real                           |

## CI architecture (read before changing tests)

- **[CI_TESTING.md](./CI_TESTING.md)** — tiers, sampling, sharding, thresholds
- **[AREA_PRIORITY.md](./AREA_PRIORITY.md)** — P0–P3 areas and coverage floors
- **[ADDING_E2E_TESTS.md](./ADDING_E2E_TESTS.md)** — checklist for new/changed E2E tests
- **[TEST_COVERAGE_MAP.md](./TEST_COVERAGE_MAP.md)** — capability registry (enforced)
- **[TEST_INVENTORY.md](./TEST_INVENTORY.md)** — per-test audit log
- **Manifest:** [`scripts/ci-playwright-manifest.json`](../../scripts/ci-playwright-manifest.json)

Spec lists for push/PR live in `scripts/ci-playwright-tiers.sh`. Exhaustive tiers auto-discover via `find`.

### How CI works

Each test job (Assistants, Account, Billing, Shell, Auth) independently:

1. **Checks out both repos** — Console + Orchestra (via the shared `CLONE_TOKEN` secret, matching the `unity`/`unify`/`unillm` workflows)
2. **Generates a minimal `.env.local`** — intentionally omits all cloud credentials so the credential-absence stubs activate. Only essential vars are set: `NEXTAUTH_SECRET`, `JWT_SECRET`, `ORCHESTRA_URL`, `ORCHESTRA_ADMIN_KEY`.
3. **Starts the full stack** via `scripts/ci-test-setup.sh`:
   - PostgreSQL (Docker container `orchestra-local-db`)
   - Orchestra FastAPI server (`ORCHESTRA_ENVIRONMENT=dev` → all backend stubs active)
   - Console production build (`next build` + `next start`) so routes are precompiled — E2E runs against a prod build, not `next dev`, to avoid per-route compile-on-demand latency (no LiveKit/GCS/Pub/Sub/Replicate creds → all frontend stubs active)
4. **Runs Playwright tests** against the live local stack
5. **Uploads artifacts** on failure (Playwright report + server logs)

### Required GitHub secrets

| Secret        | Purpose                                                                         |
| ------------- | ------------------------------------------------------------------------------- |
| `CLONE_TOKEN` | Org-shared token with read access to the Orchestra repo (same as sibling repos) |

### What gets stubbed in CI

Exactly the same stubs as local development (see table above). The `.env.local` generated by `ci-test-setup.sh` deliberately omits:

- `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `COMMS_SERVICE_ACCOUNT_CREDENTIALS`
- `REPLICATE_API_KEY`, `DEEPGRAM_API_KEY`
- `STRIPE_SECRET_KEY`

This means calls simulate a connected session, file uploads go to `/tmp`, and all external API calls return stub responses.

### Debugging CI failures

1. Download the `playwright-report-<suite>` artifact from the failed run
2. Open `index.html` locally — it contains screenshots, traces, and step-by-step logs
3. Check `test-logs-<suite>` for Console and Orchestra server logs

### Communication & Unity in CI

Communication adapters and Unity (the conversation manager) are **not** started in CI. Chat tests verify the sending side (message appears in UI) and database persistence. Assistant responses that would come through Unity are not expected in CI.

To test full round-trip chat locally, use `./scripts/local.sh start --chat`.

## Writing a New E2E Test

1. **Seed data** at module scope using `createTestUser`, `createAssistant`, etc.
2. **Create a test instance** with `createAssistantTest(user)` — this gives you an `authedPage` fixture pre-logged-in as that user.
3. **Navigate and interact** using Playwright's locator API. Prefer `getByTestId`, `getByRole`, and `getByText` over CSS selectors.
4. **Assert UI state** with `expect(locator).toBeVisible()`, `toHaveText()`, etc.
5. **Assert database state** with `dbExec("SELECT ... FROM ...")` to confirm persistence.
6. **Clean up** in `afterAll` — delete assistants, users, orgs.

## Coverage Status

Vitest suites under `_interfaces` and `_visualization` run in the **Exhaustive** tier only (`npm run test:node`, `npm run test:real`). See `src/tests/TEST_INVENTORY.md`.
