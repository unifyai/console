# CI Testing Architecture

Primary entry for Console E2E CI: tiers, sampling, sharding, and enforcement.

Related docs:

- [AREA_PRIORITY.md](./AREA_PRIORITY.md) — P0–P3 areas and coverage floors
- [TEST_COVERAGE_MAP.md](./TEST_COVERAGE_MAP.md) — capability → keeper mapping (enforced)
- [TEST_INVENTORY.md](./TEST_INVENTORY.md) — per-test audit log
- [ADDING_E2E_TESTS.md](./ADDING_E2E_TESTS.md) — checklist for new/changed tests
- [`scripts/ci-playwright-manifest.json`](../../scripts/ci-playwright-manifest.json) — machine-readable thresholds

## Two-axis model

| Axis                      | Question                                                                                    | Does not answer                              |
| ------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Area priority (P0–P3)** | How critical is the product surface? What is the minimum journey floor? How does CI sample? | Whether a specific test in a P0 file is good |
| **Per-test sweep**        | Is this test high-signal and consequential?                                                 | Whether the area can drop E2E entirely       |

P0 means the **area floor** must survive after trimming — not that every test in a P0 file stays.

## CI tiers

| Tier           | Trigger                                                       | Spec discovery                                         | Test selection                                    |
| -------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| **Push Gate**  | Every branch push without `[run-tests]`                       | Explicit file list in `scripts/ci-playwright-tiers.sh` | **All `@push` tests** (deterministic, every push) |
| **PR Gate**    | PR to `staging` / `main`                                      | Explicit file lists per job area                       | `@critical` always + priority sampling            |
| **Exhaustive** | `[run-tests]` in commit/PR title, or `workflow_dispatch` full | `find src/tests/<area>/*.e2e.ts` (auto-discovered)     | Every test in each area                           |

Tier resolution lives in `.github/workflows/tests.yml` (`resolve-tier` job).

**Push vs PR:** `@push` = platform-entry blockers (login, shell boot, critical routes, minimum chat/billing). Runs on every branch push. `@critical` = merge-gate importance; PR Gate runs all `@critical` tests in its tier file lists plus sampled non-critical tests. Not every `@critical` test is `@push`.

**`@critical` only selects inside the tier file lists.** PR Gate samples within `pr_*_specs()`; a spec no tier lists is reached only by the exhaustive matrix, where every test runs anyway. So in an exhaustive-only spec the tag selects nothing — it marks the coverage floor that `test-registry.ts` enforces by title, which is tag-independent. That is fine for P1/P2, whose absence from the PR lists is a deliberate cost trade.

It is not fine for **P0**, whose contract is 100% of `@critical` on PR with no random exclusion. A P0 `@critical` test outside every tier list reads as a merge gate it cannot be, so `check:test-inventory` fails on it: either add the spec to a tier list, or drop `@critical` and leave the spec exhaustive-only. A test's priority resolves from its `@area(...)` tag, falling back to `defaultPriorityForSpec`.

Manual tier override (e.g. PR Gate while a PR has merge conflicts):

```bash
gh workflow run Tests --ref feature/ci-revamp -f tier=pr
```

## Push Gate (`@push`)

Push Gate answers: _can a user land on the platform, authenticate, and reach critical pages?_

- Tag keeper tests with `@push @critical @area(...)` in the push-gate spec pool only.
- `SAMPLE_MODE=push` selects **every `@push` test** — no SHA-based random sampling.
- Cap enforced by `pushGateMaxTests` in `scripts/ci-playwright-manifest.json` (default 25).
- `@push` tests must live in files listed by `push_specs()` in `scripts/ci-playwright-tiers.sh`.

## PR Gate sampling

PR Gate samples **within** explicit file lists — not by dropping files.

- **Seed:** `GITHUB_SHA` (reproducible retries on the same commit)
- **Always run:** every test whose title includes `@critical`
- **Non-critical:** sampled by area priority using `scripts/ci-playwright-manifest.json`

| Area P | PR non-critical      |
| ------ | -------------------- |
| P0     | 100%                 |
| P1     | ~85%                 |
| P2     | ~65%                 |
| P3     | 0% (exhaustive only) |

Scripts:

- `scripts/ci-playwright-sample.sh` — builds Playwright `--grep` from sampled titles
- `scripts/ci-playwright-list-tests.ts` — static parse; push mode selects `@push` only
- `scripts/ci-playwright-run.sh` — runs tier; set `SAMPLE_MODE=push|pr`

## Troubleshooting

- **Push and PR are separate workflow runs.** A push run shows PR Gate jobs as _skipped_ — that is normal. Filter Actions by `event: pull_request` for PR Gate results.
- **Promotion PRs (`staging` → `main`) do not auto-run PR Gate on every `staging` push.** When the PR head is `staging` or `main`, the `pull_request` workflow is skipped so a direct push to the integration branch only runs Push Gate. Run PR Gate manually before merge: `gh workflow run Tests -f tier=pr`, or add `[run-tests]` to the PR title for an exhaustive sweep.
- **`pull_request` workflows do not run when the PR has merge conflicts** with its base branch. GitHub cannot build `refs/pull/N/merge`. Resolve conflicts with `staging`/`main`, or run `gh workflow run Tests -f tier=pr`.
- Check PR merge state: `gh pr view <n> --json mergeable,mergeStateStatus`

## Matrix sharding

Exhaustive tiers shard with Playwright `--shard=N/M`. Shard counts come from `scripts/ci-playwright-manifest.json` (`areas.*.defaultShards`).

`scripts/ci-playwright-shard.sh <tier>` prints the shard count for a tier.

PR billing uses a 3-shard matrix when the billing job runs with shards.

Files estimated longer than `splitThresholdSeconds` (480s) may get extra matrix capacity via `files.*.minShards` in the manifest.

## Threshold reference

| Key                      | Meaning                        | Default      |
| ------------------------ | ------------------------------ | ------------ |
| `pushGateMaxTests`       | Max `@push` tests in push pool | 25           |
| `prSampleRate.default`   | Default PR sample %            | 65           |
| `prSampleRate.P0`        | P0 PR override                 | 100          |
| `splitThresholdSeconds`  | Split hint for slow files      | 480          |
| `areas.*.defaultShards`  | Matrix width per area          | see manifest |
| `areas.*.timeoutMinutes` | Job timeout hint               | see manifest |

## Local commands

```bash
# Prod stack (required for gate confidence)
bash scripts/ci-test-setup.sh --no-seed

# Push tier (@push tests only)
SAMPLE_MODE=push bash scripts/ci-playwright-run.sh push-gate

# PR tier with sampling
SAMPLE_MODE=pr GITHUB_SHA=$(git rev-parse HEAD) bash scripts/ci-playwright-run.sh pr-billing

# Exhaustive shard
bash scripts/ci-playwright-run.sh exhaustive-assistants 2/5
```

## Quality gates

```bash
npm run check:test-coverage   # P0/P1 capability floors via test-registry.ts
npm run check:test-inventory  # @critical + @push pool registered and capped
```

CI runs `check:test-coverage` on PRs touching `src/tests/**` (code-quality workflow).
