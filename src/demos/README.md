# Case Study Demos

Scripted browser recordings that produce video clips for the landing page.
These are **not** tests — they seed data progressively and record the console
UI reacting in real time, producing WebM clips suitable for embedding on
case study pages.

## How it works

Each demo script:

1. Seeds a user + assistant via the same primitives as the test seeds
2. Logs in via Playwright and navigates to the assistant profile
3. Progressively seeds data (chat messages, action events) with timed
   pauses so the UI updates live — chat unfolds message by message,
   action tree builds node by node
4. Uses the local event bus (`POST /api/assistant/{id}/actions/push`)
   to stream ManagerMethod/ToolLoop events to the Live Actions panel
5. Navigates between tabs (Chat → Live Actions → Knowledge) with
   smooth cursor movement
6. Records the entire session as video

## Prerequisites

> These demos use Console's internal dev/test harness, not the product run
> path. To run the whole system locally, use **`droid stack up`** from the
> [droid repo](https://github.com/unifyai/droid).

- Local stack running: `./scripts/local.sh start` (starts Orchestra + Console + seeds)
- Docker (for seed DB access)

## Running

```bash
# Record all demos
npx playwright test --config src/demos/playwright.config.ts

# Record a specific clip
npx playwright test --config src/demos/playwright.config.ts --grep "clip-2"

# Run headed (watch it live)
npx playwright test --config src/demos/playwright.config.ts --headed
```

## Output

Videos are saved to `src/demos/recordings/`. Each demo produces
trimmed clips via the `post-process.ts` globalTeardown hook.

## Adding a new demo

1. Create `src/demos/<name>.demo.ts`
2. Import seed primitives from `@/tests/helpers/seeds/client`
3. Import recording helpers from `./helpers`
4. Use `writeMarkers()` to define trim points for automatic post-processing
