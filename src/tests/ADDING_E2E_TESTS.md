# Adding or Changing E2E Tests

Checklist for agents and developers. Read [CI_TESTING.md](./CI_TESTING.md) first.

## Required steps

1. **Assign area ID** — read [AREA_PRIORITY.md](./AREA_PRIORITY.md) (e.g. `billing.referrals`).
2. **Score the test** — consequence / signal / uniqueness. P0/P1 keepers must assert mutations + DB or money/auth boundaries.
3. **Tag the title** — `@area(<id>)` and `@critical` when the test is a floor journey for P0/P1.
4. **Register coverage** — add capability row to [`test-registry.ts`](./test-registry.ts) and human note in [TEST_COVERAGE_MAP.md](./TEST_COVERAGE_MAP.md).
5. **Update inventory** — row in [TEST_INVENTORY.md](./TEST_INVENTORY.md).
6. **Run checks:**
   ```bash
   npm run check:test-coverage
   npm run check:test-inventory
   ```
7. **Tier impact:**
   - New file under `src/tests/<area>/` → auto-included in **exhaustive** (`find`).
   - PR/push → add to `scripts/ci-playwright-tiers.sh` only when the area warrants merge-gate coverage; document why in inventory.
8. **Slow tests** — if estimated &gt; `splitThresholdSeconds` (480s), note **weight: slow** in inventory; bump manifest shards if needed.

## Do not add

- Pixel/layout-only assertions
- Dialog chrome permutations without DB or security consequence
- Duplicate capability without merging into one serial journey
- Mutation paths without DB verification
