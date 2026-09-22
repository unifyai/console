<!--
    GENERATED FILE - DO NOT EDIT DIRECTLY.

    Regenerate with:  python3 .agents/global-rules/build_agents_md.py

    Edit the sources instead:
      .agents/repo.md              this repo's overview and always-on guidance
      .agents/rules/*.md           this repo's own rules
      .agents/shared.txt           which shared rules this repo includes
      .agents/global-rules/rules/  rules shared across all unifyai repos
                                   (submodule: unifyai/global-agent-rules)
-->

# Console: The User Interface & Observability Dashboard


Console is a Next.js web application that serves as the primary user interface for the platform. Currently more internally-facing for observability, it may evolve into a customer-facing product for technical teams.

## Core Features

### Assistant Management
- Hiring flow (pre-hire chat with potential assistants)
- Profile management (photos, videos, voice selection)
- Phone number and email assignment
- Desktop/browser session configuration

### Observability Dashboard
- **Interfaces**: Top-level dashboard layouts
- **Tabs**: Grouped views within interfaces
- **Tiles**: Individual visualization components (tables, plots, metrics)
- Sophisticated prefetching and dependency management for real-time data
- Debug environment variables for development (`NEXT_PUBLIC_DEBUG_*`)

### Platform Operations
- Billing and credits management
- API key management
- Project and context management
- User profile and organization settings

## Architecture

Next.js App Router with API routes that proxy to Orchestra. Uses React Query for data fetching, Tailwind for styling, and a tile-based architecture for composable dashboards. The `/api/` routes handle authentication and forward requests to Orchestra's REST API.

## Position in the System

Console is the human interface to the platform. Users manage assistants, view logged data, and monitor system health through Console. It reads from Orchestra for all data and can dispatch messages to assistants. For developers, it provides deep visibility into Unify's operations through the logging/visualization system.

## Related Repositories

- **orchestra**: Backend API that Console reads from and writes to
- **unify**: The AI brain whose operations Console displays
- **unify-deploy**: Hosted communication stack for calls, SMS, email, and adapters
- **unisdk**: Console uses Orchestra directly (TypeScript), not the Python SDK
- **unillm**: Console uses Orchestra's chat endpoints, not UniLLM directly

---

# Repository rules

# Code Conventions

Mirror the assistants feature: `src/app/(home)/assistants/page.tsx`,
`src/hooks/Assistants/*`, `src/lib/assistants/*`, `src/lib/client/assistant.ts`,
`src/types/assistants/*`, `src/utils/assistants/*`.

## Layers

- **Server actions** (`src/lib/<feature>/*.ts`): anything needing a private
  credential (user `apiKey`, `ORCHESTRA_ADMIN_KEY`, org keys, provider secrets).
  Initialise factories in the page server component and pass down as a typed
  `*Actions` object (see `AssistantActions`). Never read `process.env.*_KEY` or
  `user.apiKey` in client code.
- **Client actions** (`src/lib/client/*.ts`): simple reads via `/api/...` routes
  using session-cookie auth. Use these when multiple calls should run in
  parallel (server actions serialize). Never for secret-bearing mutations.
- **Hooks** (`src/hooks/<Feature>/use*.ts(x)`): all non-trivial business logic.
  Components mostly read state and dispatch.
- **Types** in `src/types/<area>/`. **Utils** in `src/utils/<area>/`. No inline
  cross-file shapes; no duplicated helpers.
- **Tests** in `src/tests/<feature>/<flow>.e2e.ts`, with feature-specific
  fixtures in `src/tests/<feature>/helpers.ts` and shared seed primitives in
  `src/tests/helpers/seeds/`. See `testing-e2e-first.md` and
  `seed-scenarios.md`.

## Toasts — generic only

Never surface raw errors, exception messages, stack traces, HTTP bodies, or
backend `detail` strings to users. Log the real error with `console.error`;
show a short generic toast (e.g. "Could not save changes. Please try again.").
Intentional validation copy ("Name is required") is fine.

## Surgical edits

Make the smallest change that solves the problem. Don't rewrite a hook,
component, or module unless genuinely necessary — call it out and confirm
first. Match surrounding style (`ResponseProps`, generic toast + `console.error`,
casing helpers at Orchestra boundaries — see `quality-gates.md`).

# Local Console Dev Servers

Do not start a local Console dev server unless the user explicitly asks you to.

Before running any command that can start Console locally, including `npm run dev`,
`next dev`, `./scripts/local.sh start`, `./scripts/local.sh restart`, or a
Playwright flow that auto-starts a dev server, check for existing Console servers:

```bash
ps -axo pid,ppid,pgid,stat,etime,command | rg '/Users/djl11/console|next dev|next-server|npm run dev|PID'
lsof -nP -iTCP:3000 -iTCP:3001 -iTCP:3002 -iTCP:3333 2>/dev/null || true
```

If any Console server from `/Users/djl11/console` is already running on any port,
do not start another one. Reuse the existing server, report its URL, or ask the
user whether to stop/restart it.

Reason: multiple `next dev` processes from the same checkout share `.next`.
Running Console on two ports at once can invalidate chunks for the other server
and produce infinite loading or `/_next/static/...` 404s.

# Product Vocabulary

Console renders unify's nouns, so it inherits unify's vocabulary. The
authority is `~/unify/.agents/rules/product-vocabulary.md`; this file
carries the parts Console has to act on and the two rules that are
Console's own. When the two disagree, unify wins on nouns — but see
§"Section vs content kind", where Console got there first.

The cost of getting this wrong is not cosmetic: `Workflow` shipped as a
first-class type while "workflow" was load-bearing prose in ~180 places
across unify's prompts, and the correction took a 39-file rename that
invalidated LLM caches for the whole actor suite.

## The canonical nouns

| Concept | Word | Owner |
|---|---|---|
| Installable package that sets the assistant up for a recurring job | **workflow** | `WorkflowManager` |
| Durable unit of scheduled or triggered work | **task** ("recurring task") | `TaskScheduler` |
| One run of a task | **execution** | `Tasks/Executions` |
| Written-down multi-step how-to | **procedure** | `GuidanceManager` |
| Executable unit the assistant calls | **function** | `FunctionManager` |
| Durable sourced statement about the world | **claim** | `KnowledgeManager` |
| What the actor writes to satisfy one request | **plan** | Actor |

**"Workflow" is a noun you install.** Everything that used to borrow the
word is a procedure, a task, or a plan. Do not write "recurring workflow"
— that is a recurring task. Do not name a test scenario a "workflow"; use
journey, sequence or flow.

Exceptions that are not ours to rename: third-party product names (HubSpot
and Salesforce both ship features called Workflows — integration copy must
stay factually right), and GitHub's API keywords (`.github/workflows/`,
`workflow_dispatch`, `workflow_run`).

## Integration slugs and the three connection routes

A workflow requirement's `slug` is a **provider app slug** — lowercase, the
same id space as `canonicalSlug` in the integrations gallery
(`gmail`, `google_calendar`, `notion`). An OAuth alias that is valid
upstream but absent from the gallery renders a chip with no logo and no
working action; the shipped bundle once said `google_workspace` where it
meant `gmail`. A requirement slug that does not resolve to a gallery
definition is a **bundle bug**, and Console reports it loudly in
development rather than rendering a blank chip.

The gallery offers two kinds of app that connect three ways, and the
route decides the fix. Offering the wrong one is worse than offering
none — OAuth does nothing for an app gated on a secret:

| `via` | Satisfied by | The fix to offer |
|---|---|---|
| `connection` | a provider-backed connection row | the gallery's connect handshake |
| `native_package` | the integration package's own secrets | name the secrets, route to where secrets are entered |
| `secret` | a named secret (BYOD OAuth: Google Workspace, Microsoft 365) | name the secrets, route to where secrets are entered |
| `undeclared` | nothing to check | render nothing; reads as met |

An app reachable more than one way needs only **one** route: a live
connection outranks a missing secret. And an unmet requirement is never an
error — it is one step remaining, per route.

## "Skill" is an umbrella, never one member

In unify, **skill** covers functions, procedures and claims *together* —
hence `store_skills` and the "Storing Reusable Skills" review label. It is
a legitimate superset and should be kept wherever the storage-review loop
is what is meant.

It is wrong for one specific member. Console's function view model is
`FunctionEntry` (`src/utils/assistants/functions.ts`) with locals named
`fn` / `functions`; do not reintroduce `skill` for a single function.

## Section vs content kind

A rail section is a **library**; what it holds is a **content kind**. These
are different words on purpose, and flattening them is a regression:

| Content kind | Lives in (section) |
|---|---|
| Procedures | Guidance |
| Knowledge claims | Knowledge |
| Recurring tasks | Tasks |
| Functions | Functions |
| Canvases | Canvas |
| Data tables | Data |

`src/components/Workflows/workflowCategories.ts` encodes this as
`label` (content kind) / `livesIn` (section) / `sectionId` (deep link).
The workflow sheet saying "Procedures" while the rail says "Guidance" is
correct, not an inconsistency. Do not rename rail sections to match
content kinds, and do not collapse the `label` / `livesIn` split.

## Never key logic off display-label prose

`display_label` is copy. Unify rewords it freely — this rule's own
existence caused a sweep of those strings — and a matcher that reads it
**fails silently**: the view falls through to generic rendering and nobody
notices until a screenshot weeks later.

Key off stable identifiers instead: manager and method names
(`SkillManager.store`, `WorkflowManager.install_workflow`), tool names
(`execute_code`, `search_web`), or slugs. Those change under review.

`src/components/Pages/Assistants/LiveActions/actionNodePresentation.ts`
is the worked example: identity keys first, prose only as a fallback, both
exported as data and pinned by
`src/tests/assistants/actionNodePresentation.node.test.ts` so a drift
fails loudly. Apply the same shape to any new surface that renders unify
events — including Workflows.

# Quality Gates

Run before declaring done; fix issues in code, not with `eslint-disable` /
`@ts-ignore` / `@ts-expect-error` (comment if a suppression is unavoidable).

```bash
npm run ci        # lint + typecheck + format:check + check:styles:all + build
```

## Security audit (when deps change)

If `package.json` / lockfile changed, run `npm audit` (matches
`.github/workflows/security.yml` — fails on critical, warns on high/moderate).
Prefer upgrading the offending package over an override.

## Casing — snake_case ↔ camelCase

Orchestra speaks snake_case; the frontend uses camelCase. For every new call
site, identify which side does the conversion and don't double-convert. Bugs
here type-check fine but produce `undefined` fields at runtime.

**Auto-handled (pass/read camelCase, no helpers):**

- `createOrchestraClient(apiKey)` — `src/lib/orchestra/client.ts`
- `OrchestraAdminClient`, `getOrchestraUserClient(apiKey)` —
  `src/lib/orchestra/orchestra-client.ts`
- `fetchOrchestra<T>` — `src/utils/casing.ts`

**Manual (use `@/utils/casing` helpers):**

- Raw `fetch`, `loggedFetch`, `fetchOrchestraRaw`, raw axios.
- `/api/...` reads from `src/lib/client/*.ts` (route returns Orchestra's body
  verbatim → `snakeToCamelObject` on read, `camelToSnakeObject` on write).
- Non-Orchestra services — convert at the boundary per that service's casing.

## E2E

Per `testing-e2e-first.md`, run the touched specs locally:

```bash
npx playwright test src/tests/<feature>/<flow>.e2e.ts
```

# Seed Scenarios

Local Orchestra is seeded via scenarios in
`src/tests/helpers/seeds/scenarios/`. They feed both manual testing
(DevQuickLogin picks up credentials) and E2E tests.

When you add or change a user flow, update seeds so the new state is
reachable locally:

- Extend an existing scenario before adding a new one (catalogue:
  `personal-workspace`, `org-basic`, `org-multi-role`, `billing-banner-states`,
  `chat-search`, `memory-rich`, `tasks-rich`, `secrets-rich`, `usage-ledger`,
  `re-appraisal`, ...).
- Compose using primitives from `src/tests/helpers/seeds/client.ts`
  (`createUser`, `createOrg`, `addMember`, `createAssistant`, `createSecret`,
  `createEmailLogin`, `seedChatInfrastructure`, ...). No ad-hoc SQL.
- Return a `SeededState` with `users`, `org`, `assistants`, `credentials`.
- New scenario? Register in both `seeds/index.ts` and `seeds/run.ts`.

Skip the update only if the change is cosmetic and reachable from any
logged-in user.

Verify: `npx tsx src/tests/helpers/seeds/run.ts <scenario>` or
`./scripts/local.sh start`, then walk the flow.

# Styling — Stick to Globals

Use the CSS variables in `src/styles/globals.css` (and their Tailwind classes
from `tailwind.config.ts`) for every colour, radius, and theme value. Use the
font classes from `src/styles/fonts.ts`. Tokens are theme-aware (light/dark) —
hardcoding breaks dark mode and fails `scripts/check-colors.ts` /
`scripts/check-font-classes.ts` (run via `lint-staged` and `check:styles:all`).

Don't use: hex, `rgb(...)`, named Tailwind colours (`bg-white`, `text-red-500`),
arbitrary `bg-[#...]`, inline `font-family`, ad-hoc pixel radii.

```tsx
// ❌ <div className="bg-[#f5f5f5] text-[#1b1b1b] border-[#dadada]" />
// ✅ <div className="bg-background text-foreground border-border" />
```

Genuinely new token? Add it to both `:root` and `.dark` in `globals.css`,
expose via `tailwind.config.ts`, then use the class — never the raw value.

## The small band

The ramp's reading sizes bottom out at `text-caption` (12.5px). Chrome lives
below that, so the band beneath it has named steps rather than an arbitrary
value per surface:

| Class                          | Job                                       |
| ------------------------------ | ----------------------------------------- |
| `text-body-dense` (13px)       | A row's own label — nav items, list rows  |
| `text-caption-sm` (11px)       | Metadata beneath a row's title            |
| `text-overline` (10px mono)    | A heading that names a region             |
| `text-data-header` (11px mono) | A column header over dense values         |

Casing separates the last two from the rest, and the split is load-bearing:
**uppercase mono names a region; sentence-case sans describes the row it sits
under.** "WORKSPACE" heads a group of nav rows; "Organization" describes the
workspace named directly above it. Both are correct — do not level them.

## No arbitrary sizes or radii

`text-[13px]` and `rounded-[9px]` answer to no scale, and most are a token
spelled out by hand (`rounded-[10px]` is exactly `rounded-lg`). Both are
checked, and both carry a ratchet in `scripts/style-baseline.json`: a file may
never exceed the count recorded there, and a file absent from it is held at
zero. Bring a count down and refresh with:

```bash
npm run check:styles:baseline
```

Never raise a count to make a check pass — that is the drift the baseline
exists to stop.

## Rail geometry

The app rail has one content inset. Every leading glyph, avatar and label
starts there; every trailing control's box ends there. The values live in
`src/components/Layout/Shell/railGeometry.tsx` and nowhere else — a row that
hardcodes its own padding drifts by two or three pixels, which reads as
sloppiness without ever being nameable.

- `RAIL_GUTTER` on the container, `RAIL_ROW_PAD` on the row. Never both on one
  element: they are the same class, so `cn` merges them and the row lands half
  an inset short.
- `RAIL_FLUSH_PAD` for a row that sits directly on the rail instead.
- `RailTrailingButton` for every trailing control — section menus, pins, both
  switcher chevrons, the drawer's close. One glyph size, one box, one inset.
- A bare trailing indicator takes `RAIL_TRAILING_SLOT` so it centres on the
  same axis as the buttons beside it.

# Testing — E2E First

No unit tests. Write browser-based E2E tests that run against the real local stack, exercise the real
UI through user journeys and (whenever the flow mutates data) verify the resulting backend state. See `src/tests/README.md`.

Rules:

- File: `src/tests/<feature>/<flow>.e2e.ts`.
- Seed at module scope via `@/tests/helpers/seeds` and `<feature>/helpers`
  (`createTestUser`, `createAssistantTest`, etc.). Clean up in `afterAll`.
- Drive Playwright with `getByTestId` / `getByRole` / `getByText`.
- Assert visible UI for reads. For mutations, **also** assert the DB with
  `dbExec("SELECT ...")` — UI alone can be optimistic.
- No mocked `fetch`, server actions, or DB. Local stubs activate via missing
  credentials (see `src/tests/README.md`).
- No snapshot-only or screenshot-only assertions.
