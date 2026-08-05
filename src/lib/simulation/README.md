# Mock Simulation Mode

Boot the **real** Console shell against hardcoded, in-memory fixtures with **no
backend** (no Orchestra, Postgres, or auth). It exists for design / QA / demo
walkthroughs of every revamped surface, including empty/loaded/edge states,
without a full local stack or the right seeded scenario.

## Enabling it

Set the single build-time flag and (re)start the server:

```bash
npm run dev:mock
# or explicitly
NEXT_PUBLIC_MOCK_SIM=true npm run dev

# production-style run (flag must be present at build time)
npm run build:mock && npm run start:mock
```

Then open **`/mock`** to pick a scenario + persona. Selecting one establishes the
mock session (via cookies) and drops you into the real shell at `/assistants`.
A persistent **MOCK** badge (bottom-right) shows the active scenario/persona and
links back to `/mock` to switch.

### Quick walkthrough (unified shell)

After entering a scenario, exercise the refactored assistant shell:

| Area               | What to check                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Workspace rail** | Chat, Actions, Dashboards, Tasks, Workflows, Integrations                                                                |
| **Brain rail**     | Contacts, Transcripts, Knowledge (typed claims + provenance), Functions (link debt), Guidance, Data                      |
| **Settings**       | Account, Billing, Usage (billing + ledger mocked)                                                                        |
| **Chat**           | History from fixtures; sample table/plot embed messages                                                                  |
| **Actions**        | ManagerMethod + ToolLoop tree from fixtures                                                                              |
| **Dashboards**     | Layout + HTML tiles                                                                                                      |
| **Tasks**          | Task cards, run history, optional running-task rail dot                                                                  |
| **Workflows**      | Curated shelf with every install state; install/connect/uninstall transitions (client-side, via `workflow-mock-data.ts`) |
| **Integrations**   | Connected apps + paginated catalog browse                                                                                |

The flag is read through `process.env.NEXT_PUBLIC_MOCK_SIM`, so it inlines at
build time. When it is off (the default, and in every prod/CI build) **none of
the simulation code paths are reachable** — the app uses the real backend.

> The flag must be present at build time for a production build; setting it only
> at runtime against a build made without it has no effect (Next.js inlines
> `NEXT_PUBLIC_*` at build).

## How it works

Interception happens at shared **data boundaries**, never inside display
components, so views are unaware they run on fixtures:

- **Identity** — `lib/user/user.ts` (`getSession`/`getCurrentUser`) and
  `app/api/_utils/auth.ts` (API-key resolvers) return a mock user/workspace.
  `middleware.ts` bypasses NextAuth gating.
- **Transport** — the Orchestra clients (`lib/orchestra/client.ts` openapi-fetch,
  `lib/orchestra/orchestra-client.ts` axios) and the fetch helpers in
  `utils/casing.ts` route through a single `simulationFetch` seam (`dispatch.ts`).

`simulationFetch` resolves the active scenario/workspace purely from the
request's `Authorization` header — the mock API key encodes both
(`mock-sim-key:<scenario>::<workspace>`) — so the dispatcher needs no
`next/headers` and stays out of client bundles. It matches `method + pathname`
against handlers grouped by surface and returns UI-shaped JSON; unmatched paths
degrade to safe empty bodies (empty states) instead of crashing.

Handlers emit **camelCase** keys: the snake→camel response pipeline is idempotent
for already-camelCase keys, so the UI receives exactly what the handlers return.

## Layout

| Path                 | Responsibility                                                                |
| -------------------- | ----------------------------------------------------------------------------- |
| `config.ts`          | `mockSimulationEnabled()`, cookie names, mock API-key encode/parse            |
| `types.ts`           | App-safe fixture shapes (no `src/tests/` imports)                             |
| `scenario.ts`        | Pure scenario registry + persona resolution (client-safe)                     |
| `scenario-server.ts` | Cookie-based active-scenario resolution (`server-only`)                       |
| `identity.ts`        | Builds the mock `User`/`Session` for a scenario/workspace                     |
| `store.ts`           | Per-process mutable session; resets on reload/restart                         |
| `dispatch.ts`        | `simulationFetch` seam + handler dispatch                                     |
| `handlers/`          | Grouped handlers (identity, assistants, projects, brain, billing, interfaces) |
| `fixtures/`          | Hardcoded data per surface                                                    |

## Adding coverage

- **New endpoint:** add a handler in the relevant `handlers/*.ts` (or a new
  group registered in `handlers/index.ts`). Match `method + pathname` and return
  camelCase JSON shaped like the UI expects.
- **New scenario:** add fixtures under `fixtures/` and register the scenario in
  `scenario.ts`. It then appears automatically on `/mock` and in the switcher.

Mutations should update the in-memory `store.ts` so interactions feel real within
a session; everything resets on reload. Nothing is ever written to a backend.
