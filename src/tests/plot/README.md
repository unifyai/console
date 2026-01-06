# Plot Tests

Comprehensive test suite for plot/chart functionality in the Console frontend.

## Directory Structure

```
src/tests/plot/
├── README.md                           # This file
├── fixtures/
│   ├── configs.ts                      # Test matrix configs and generators
│   ├── mockData.ts                     # Type-aware mock data generators
│   ├── calculations.ts                 # Position/dimension calculators
│   ├── plotCanvasTestHarness.tsx       # Direct PlotCanvas testing harness
│   └── handlers.ts                     # MSW handlers for API mocking
├── api/
│   ├── plot.api.node.test.ts           # API edge case tests (Node.js)
│   ├── plot.api.matrix.node.test.ts    # API matrix tests (Node.js, shardable)
│   └── _api-helpers.ts                 # Shared API test utilities
├── integration/
│   ├── bar.browser.test.tsx            # Bar chart edge cases & interactions
│   ├── bar.matrix.browser.test.tsx     # Bar chart matrix tests (11,648 configs)
│   ├── scatter.browser.test.tsx        # Scatter plot edge cases & interactions
│   ├── scatter.matrix.browser.test.tsx # Scatter plot matrix tests (1,568 configs)
│   ├── histogram.browser.test.tsx      # Histogram edge cases & interactions
│   ├── histogram.matrix.browser.test.tsx # Histogram matrix tests (784 configs)
│   ├── line.browser.test.tsx           # Line chart edge cases & interactions
│   ├── line.matrix.browser.test.tsx    # Line chart matrix tests (784 configs)
│   ├── transitions.browser.test.tsx    # Plot type transition tests
│   ├── _bar-test-helpers.ts            # Shared bar chart test utilities
│   ├── _scatter-test-helpers.ts        # Shared scatter plot test utilities
│   ├── _line-test-helpers.ts           # Shared line chart test utilities
│   ├── _histogram-test-helpers.ts      # Shared histogram test utilities
│   └── generated/                      # Auto-generated chunk files for parallelism
├── unit/
│   ├── data.node.test.ts               # Data utility unit tests
│   ├── axes.node.test.ts               # Axes utility unit tests
│   ├── tooltip.node.test.ts            # Tooltip utility unit tests
│   └── key.node.test.ts                # Legend/key utility unit tests
└── benchmarks/
    ├── rendering.perf.browser.test.tsx # Rendering performance benchmarks
    └── dataProcessing.perf.node.test.ts # Data processing benchmarks
```

## Quick Start

```bash
# Run browser matrix tests (14,784 tests at 100%)
npm run test:browser:matrix 4          # 4 parallel shards

# Run with sampling for faster iteration
PLOT_TEST_SAMPLE_RATE=10 npm run test:browser:matrix 4   # 10% = ~1,480 tests

# Run Node.js API matrix tests
npm run test:node:matrix 4             # 4 parallel shards

# Run unit tests
npm run test:node -- src/tests/plot/unit/
```

## Test Matrix Overview

### Total Test Counts (100% sampling)

| Plot Type | Configs | Coverage |
|-----------|---------|----------|
| Bar | 11,648 | All x-axis types × plot options × scales |
| Scatter | 1,568 | Numeric/temporal x-axis × plot options × scales |
| Line | 784 | Numeric/temporal x-axis × plot options × scales |
| Histogram | 784 | Numeric/temporal x-axis × plot options × scales |
| **Total** | **14,784** | |

### Data Type Coverage

Tests now cover **all production-supported data types**:

| Data Type | Bar | Scatter | Line | Histogram | Notes |
|-----------|-----|---------|------|-----------|-------|
| float | ✅ | ✅ | ✅ | ✅ | Standard numeric |
| int | ✅ | ✅ | ✅ | ✅ | Standard numeric |
| datetime | ✅ | ✅ | ✅ | ✅ | ISO 8601 timestamps |
| time | ✅ | ✅ | ✅ | ✅ | HH:MM:SS format |
| timedelta | ✅ | ✅ | ✅ | ✅ | Python timedelta format |
| date | ✅ | ✅ | ✅ | ✅ | YYYY-MM-DD format |
| str | ✅ | - | - | - | Categorical (bar only) |
| bool | ✅ | ✅ | ✅ | ✅ | Boolean → 0/1 |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLOT_TEST_SCALE` | Which scale(s) to run: `small`, `medium`, `large`, or `all` | `small` |
| `PLOT_TEST_SAMPLE_RATE` | Percentage of configs to sample (1-100) | `100` |
| `PLOT_TEST_API_REAL` | Use real API instead of mocked responses | `false` |
| `VITE_TEST_API_URL` | Backend URL for real API tests | `http://localhost:3000` |
| `VITE_TEST_API_KEY` | API key for authentication | `test-api-key-12345` |

### Scale Options

| Scale | Data Points | Timeout | Use Case |
|-------|-------------|---------|----------|
| `small` | ~100 | 5s | Quick iteration, local development (default) |
| `medium` | ~1,000 | 15s | Standard testing |
| `large` | ~10,000 | 30s | Full CI, performance validation |
| `all` | All scales | - | Complete test coverage |

## Running Tests

### Browser Matrix Tests (Recommended)

The browser matrix tests use file splitting and sharding for true parallelism:

```bash
# Run with auto-detected shard count (capped at 8)
npm run test:browser:matrix

# Run with specific shard count
npm run test:browser:matrix 4          # 4 parallel browser instances
npm run test:browser:matrix 8          # 8 parallel browser instances

# Run with sampling for faster iteration
PLOT_TEST_SAMPLE_RATE=25 npm run test:browser:matrix 4   # 25% = ~3,696 tests
PLOT_TEST_SAMPLE_RATE=10 npm run test:browser:matrix 4   # 10% = ~1,480 tests
PLOT_TEST_SAMPLE_RATE=5 npm run test:browser:matrix 2    # 5% = ~740 tests
```

The command handles the entire workflow:
1. **Generate** chunk files (splits matrix tests into parallel-runnable files)
2. **Run** tests with Vitest sharding
3. **Cleanup** generated files automatically

### Node.js Matrix Tests

For API tests running in Node.js:

```bash
# Run with specific shard count
npm run test:node:matrix 4             # 4 parallel processes

# Run with custom sample rate
PLOT_TEST_SAMPLE_RATE=50 npm run test:node:matrix 4

# Run specific test file
npm run test:node:matrix 4 src/tests/plot/api/plot.api.matrix.node.test.ts
```

### Individual Test Files

```bash
# Browser tests (non-matrix)
npm run test:browser -- --run src/tests/plot/integration/bar.browser.test.tsx

# Node.js unit tests
npm run test:node -- --run src/tests/plot/unit/

# API edge case tests
npm run test:node -- --run src/tests/plot/api/plot.api.node.test.ts
```

### Examples

```bash
# Quick local iteration (2% sampling, 2 shards)
PLOT_TEST_SAMPLE_RATE=2 npm run test:browser:matrix 2

# CI full run (100% sampling, 8 shards)
npm run test:browser:matrix 8

# Test with real API
PLOT_TEST_API_REAL=true VITE_TEST_API_URL=http://localhost:3000 npm run test:node:matrix 4

# Debug specific plot type failures
npm run test:browser -- --run -t "bar-bar-x-timedelta"
```

## Test Architecture

### Matrix Test Runners

#### Browser (`matrixTestRunnerBrowser.ts`)

Used for integration tests that require a real browser (SVG rendering, D3 interaction):

```typescript
import { defineMatrixTests } from '@/tests/utils/matrixTestRunnerBrowser';

export const matrixTests = defineMatrixTests<MyConfig>({
  name: 'Bar Chart - Matrix Tests',
  getMatrix: generateBarChartMatrix,  // Returns all config combinations
  defineTests: defineBarChartTests,    // Test function for each config
  chunkSize: 25,                        // Configs per generated file
  getConfigAlias: (config) => `bar-${config.plotConfig.type}-...`,
});
```

#### Node.js (`matrixTestRunnerNode.ts`)

Used for API tests that run in Node.js with `describe.concurrent`:

```typescript
import { defineNodeMatrixTests } from '@/tests/utils/matrixTestRunnerNode';

defineNodeMatrixTests<ApiContext>({
  name: 'Plot API - Matrix Tests',
  concurrent: true,
  getMatrix: buildApiTestMatrix,
  defineTests: (ctx, { it, expect }) => {
    it('validates response', async () => { /* ... */ });
  },
  getConfigAlias: (ctx) => `${ctx.plotType}-${ctx.scale.name}`,
});
```

### File Splitting (Browser Tests)

Browser matrix tests are split into multiple files for true parallelism:

```
src/tests/plot/integration/
├── bar.matrix.browser.test.tsx          # Source: exports matrixTests
└── generated/
    ├── bar.matrix.0.browser.test.tsx    # Chunk 0: configs 0-24
    ├── bar.matrix.1.browser.test.tsx    # Chunk 1: configs 25-49
    └── ...                               # Up to 466 chunks for bar
```

Each chunk file imports from the source and runs a subset of the matrix:

```typescript
import { matrixTests } from '../bar.matrix.browser.test';
import { runMatrixChunk } from '../../utils/matrixTestRunnerBrowser';

runMatrixChunk(matrixTests, 0);  // Run chunk 0
```

### Sharding (Vitest)

Vitest's `--shard` flag distributes chunk files across processes:

```bash
# Shard 1/4 runs chunks: 0, 4, 8, 12, ...
# Shard 2/4 runs chunks: 1, 5, 9, 13, ...
# etc.
```

## Test Structure

### Matrix-Driven Testing

Tests use a **matrix approach** for comprehensive coverage:

```
Plot Configs × Data Types × Scales = Full Matrix
    364      ×    32     ×   1   = 11,648 (bar)
     56      ×    28     ×   1   = 1,568  (scatter)
     28      ×    28     ×   1   = 784    (line, histogram)
```

### Test File Organization

Each plot type has two test files:

1. **`*.browser.test.tsx`** - Edge cases and interactions (sequential)
2. **`*.matrix.browser.test.tsx`** - Matrix tests (parallel, chunked)

```typescript
// bar.browser.test.tsx - Edge cases
describe('Bar Chart - Edge Cases', () => {
  it('handles empty data gracefully');
  it('handles single category');
  it('handles zero values');
});

// bar.matrix.browser.test.tsx - Matrix tests
export const matrixTests = defineMatrixTests<BarMatrixConfig>({
  name: 'Bar Chart - Matrix Tests',
  getMatrix: generateBarChartMatrix,
  defineTests: defineBarChartTests,
});
```

## Config Dimensions

### Plot Config Options

| Option | Values | Applicable To |
|--------|--------|---------------|
| `scale_x` | linear, log | All |
| `scale_y` | linear, log | All |
| `aggregate` | sum, mean, count, min, max | All (requires group_by) |
| `group_by` | with/without | All |
| `show_regression` | true/false | Scatter only |
| `bin_count` | 1, 10, 50, 100 | Histogram only |
| `sort_by` | x, y, value, name | Bar only |
| `sort_order` | asc, desc | Bar only |

### Data Type Options

```typescript
export const dataTypeOptions = {
  // All types supported by production plotting code
  x_axis_type: ['float', 'int', 'datetime', 'time', 'timedelta', 'date', 'str', 'bool'],
  y_axis_type: ['float', 'int'],
  group_by_type: ['str', 'bool'],
};
```

### Validity Filtering

The `filterValidPlotConfigs()` function prunes invalid combinations:
- Regression: scatter only
- Non-default bin count: histogram only
- Sort options: bar only
- Aggregate: requires group_by
- Log scales: not for histograms (always linear)

## Assertions

### Integration Tests

Matrix tests verify **exact** values, not just validity:

| Plot Type | Assertions |
|-----------|------------|
| **Bar** | Exact bar count (categories × groups), consistent widths, proportional heights |
| **Scatter** | Exact point count, positions within tolerance, consistent radii |
| **Line** | Valid path (no NaN/Infinity), within plot bounds, segment count |
| **Histogram** | Bin count in range, consistent widths, contiguous bins, proportional heights |

### API Tests

Matrix tests verify:
- **Config Correctness**: All fields transformed correctly
- **Data Correctness**: Count, structure, data types, value ranges
- **Data Preprocessing**: Field prefixing, entry merging, type preservation
- **Field Correctness**: Prefixed paths, correct type metadata
- **Metadata Completeness**: Project name, timestamps, tokens

## Mock Data

### Deterministic Data

For precise position assertions:

```typescript
const deterministicData = createDeterministicMockLogs(
  { x_axis_type: 'datetime', y_axis_type: 'float', group_by_type: 'str' },
  100 // count
);

// Returns:
// - logs: Array with predictable values
// - expectedXValues: Pre-computed X values
// - expectedYValues: Pre-computed Y values
// - xDomain: { min, max }
// - yDomain: { min, max }
```

### Value Conversion

Mock data uses the same conversion logic as production's `getValue()`:

| Type | Mock Value | Converted Value |
|------|------------|-----------------|
| datetime | `"2024-01-15T12:00:00Z"` | `1705320000000` (ms) |
| time | `"12:30:45"` | Timestamp for today at 12:30:45 |
| timedelta | `"3 days, 08:00:00"` | `288000000` (ms) |
| date | `"2024-01-15"` | `1705276800000` (ms) |
| bool | `true` / `false` | `1` / `0` |

## Calculation Utilities

`calculations.ts` provides helpers for computing expected values:

```typescript
import {
  calculateExpectedPointCount,
  calculateExpectedBarCount,
  toNumericValue,           // Converts like production getValue()
  isValidNumericValue,      // Checks if value can be plotted
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
} from '../fixtures/calculations';
```

## Adding New Tests

### New Data Type

1. Add to `dataTypeOptions.x_axis_type` in `configs.ts`
2. Add value generator in `mockData.ts` (`deterministicValueGenerators`)
3. Update `toNumericValue()` in `calculations.ts` if needed

### New Plot Type

1. Add type to `plotConfigOptions.type` in `configs.ts`
2. Update `filterValidPlotConfigs()` with type-specific rules
3. Create `newtype.browser.test.tsx` and `newtype.matrix.browser.test.tsx`
4. Create `_newtype-test-helpers.ts` with assertions
5. Add harness methods in `plotCanvasTestHarness.tsx`

### New Config Option

1. Add to `plotConfigOptions` in `configs.ts`
2. Update `generateAllPlotConfigs()` loops
3. Update `filterValidPlotConfigs()` validity rules
4. Update `generateTestAlias()` for test naming
