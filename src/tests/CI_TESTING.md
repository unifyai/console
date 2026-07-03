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

| Tier           | Trigger                                                  | Spec discovery                                         |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------ |
| **Push Gate**  | Every branch push without `[run-tests]`                  | Explicit file list in `scripts/ci-playwright-tiers.sh` |
| **PR Gate**    | PR to `staging` / `main`                                 | Explicit file lists per job area                       |
| **Exhaustive** | `[run-tests]` in commit/PR title, or `workflow_dispatch` | `find src/tests/<area>/*.e2e.ts` (auto-discovered)     |

Tier resolution lives in `.github/workflows/tests.yml` (`resolve-tier` job).

## Random sampling (push / PR)

Push and PR tiers sample **within** explicit file lists — not by dropping files.

- **Seed:** `GITHUB_SHA` (reproducible retries on the same commit)
- **Always run:** every test whose title includes `@critical`
- **Non-critical:** sampled by area priority using `scripts/ci-playwright-manifest.json`

| Area P | Push non-critical                              | PR non-critical      |
| ------ | ---------------------------------------------- | -------------------- |
| P0     | 100% (same as critical set on push file lists) | 100%                 |
| P1     | ~50%                                           | ~85%                 |
| P2     | ~35%                                           | ~65%                 |
| P3     | ~20%                                           | 0% (exhaustive only) |

Scripts:

- `scripts/ci-playwright-sample.sh` — builds Playwright `--grep` from sampled titles
- `scripts/ci-playwright-list-tests.ts` — static parse + priority-aware sampling
- `scripts/ci-playwright-run.sh` — runs tier; set `SAMPLE_MODE=push|pr`

## Matrix sharding

Exhaustive tiers shard with Playwright `--shard=N/M`. Shard counts come from `scripts/ci-playwright-manifest.json` (`areas.*.defaultShards`).

`scripts/ci-playwright-shard.sh <tier>` prints the shard count for a tier.

PR billing uses a 3-shard matrix when the billing job runs with shards.

Files estimated longer than `splitThresholdSeconds` (480s) may get extra matrix capacity via `files.*.minShards` in the manifest.

## Threshold reference

| Key                                     | Meaning                   | Default      |
| --------------------------------------- | ------------------------- | ------------ |
| `pushSampleRate.default`                | Default push sample %     | 35           |
| `prSampleRate.default`                  | Default PR sample %       | 65           |
| `pushSampleRate.P0` / `prSampleRate.P0` | P0 override               | 100          |
| `splitThresholdSeconds`                 | Split hint for slow files | 480          |
| `areas.*.defaultShards`                 | Matrix width per area     | see manifest |
| `areas.*.timeoutMinutes`                | Job timeout hint          | see manifest |

## Local commands

```bash
# Prod stack (required for gate confidence)
bash scripts/ci-test-setup.sh --no-seed

# Push tier (no sampling)
bash scripts/ci-playwright-run.sh push-gate

# PR tier with sampling
SAMPLE_MODE=pr GITHUB_SHA=$(git rev-parse HEAD) bash scripts/ci-playwright-run.sh pr-billing

# Exhaustive shard
bash scripts/ci-playwright-run.sh exhaustive-assistants 2/5
```

## Quality gates

```bash
npm run check:test-coverage   # P0/P1 capability floors via test-registry.ts
npm run check:test-inventory  # @critical tests registered in coverage map
```

CI runs `check:test-coverage` on PRs touching `src/tests/**` (code-quality workflow).
