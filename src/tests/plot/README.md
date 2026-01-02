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
│   └── plot.api.node.test.ts           # API endpoint tests (Node.js)
├── integration/
│   ├── scatter.browser.test.tsx        # Scatter plot integration tests
│   ├── bar.browser.test.tsx            # Bar chart integration tests
│   ├── histogram.browser.test.tsx      # Histogram integration tests
│   ├── line.browser.test.tsx           # Line chart integration tests
│   └── transitions.browser.test.tsx    # Plot type transition tests
├── unit/
│   ├── data.node.test.ts               # Data utility unit tests
│   ├── axes.node.test.ts               # Axes utility unit tests
│   ├── tooltip.node.test.ts            # Tooltip utility unit tests
│   └── key.node.test.ts                # Legend/key utility unit tests
└── benchmarks/
    ├── rendering.perf.browser.test.tsx # Rendering performance benchmarks
    └── dataProcessing.perf.node.test.ts # Data processing benchmarks
```

## Test Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PLOT_TEST_SCALE` | Which scale(s) to run: `small`, `medium`, `large`, or `all` | `small` |
| `PLOT_TEST_SAMPLE_RATE` | Percentage of configs to sample (1-100) | `100` |
| `PLOT_TEST_MATRIX_DEBUG` | Log test matrix details | `false` |
| `PLOT_TEST_API_REAL` | Use real API (set to `false` for mocked responses) | `true` |
| `VITE_TEST_API_URL` | Backend URL for real API tests | `http://localhost:3000` |
| `VITE_TEST_API_KEY` | API key for authentication | `test-api-key-12345` |

### Scale Options

| Scale | Data Points | Timeout | Use Case |
|-------|-------------|---------|----------|
| `small` | ~100 | 5s | Quick iteration, local development (default) |
| `medium` | ~1,000 | 15s | Standard testing |
| `large` | ~10,000 | 30s | Full CI, performance validation |
| `all` | All scales | - | Complete test coverage |

### Examples

```bash
# Default (small scale only)
npm test

# Medium scale tests
PLOT_TEST_SCALE=medium npm test

# Large scale performance testing
PLOT_TEST_SCALE=large npm test

# All scales (comprehensive)
PLOT_TEST_SCALE=all npm test

# Quick iteration with config sampling
PLOT_TEST_SCALE=small PLOT_TEST_SAMPLE_RATE=25 npm test

# Use mocked API responses instead of real backend
PLOT_TEST_API_REAL=false npm test

# Test against a specific backend URL with custom API key
VITE_TEST_API_URL=http://localhost:8000 VITE_TEST_API_KEY=my-api-key npm test

# Debug matrix generation
PLOT_TEST_MATRIX_DEBUG=true npm test
```

## Test Structure Philosophy

### Matrix-Driven Testing

Tests use a **matrix approach** where comprehensive coverage is achieved through the matrix tests block. Non-matrix tests are reserved for:

1. **Edge Cases** - Invalid/boundary conditions not covered by valid matrix combinations
2. **User Interactions** - Hover, zoom, click behaviors
3. **Error Scenarios** - Authentication failures, validation errors, etc.

### API Tests Structure

API tests support **two modes**:

1. **Real API** (default): Tests against actual running backend
2. **Mocked API** (`PLOT_TEST_API_REAL=false`): Uses MSW handlers for fast, deterministic testing

```typescript
describe('Plot API', () => {
  // Edge cases only
  describe('Authentication', () => { /* auth failures */ });
  describe('Input Validation', () => { /* missing fields */ });
  describe('Error Scenarios', () => { /* 404, 500, expired */ });
  
  // Matrix-driven comprehensive tests
  describe('Matrix Tests', () => {
    describe.each(plotTypes)('%s plot', (plotType) => {
      describe.each(plotConfigs)('plot config: %o', (plotConfig) => {
        describe.each(projectConfigs)('project config: %o', (projectConfig) => {
          describe.each(dataTypes)('data types: %o', (dataType) => {
            describe.each(scales)('scale: %s', (scale) => {
              it('returns correct config structure');
              it('returns correctly structured data');
              it('applies correct data preprocessing');
              it('returns correctly transformed fields');
              it('includes complete metadata');
            });
          });
        });
      });
    });
  });
});
```

### Integration Tests Structure

Integration tests use **deterministic mock data** for precise SVG element assertions:

```typescript
describe('Scatter Plot', () => {
  // Edge cases not in matrix
  describe('Edge Cases', () => {
    it('handles empty data');
    it('handles all-null values');
    it('handles extreme outliers');
  });
  
  // User interactions
  describe('Interactions', () => {
    it('has tooltip element');
    it('supports zoom when enabled');
  });
  
  // Matrix-driven comprehensive tests
  describe('Matrix Tests', () => {
    describe.each(configs)('config: %o', (config) => {
      describe.each(dataTypes)('data types: %o', (dataType) => {
        describe.each(scales)('scale: %s', (scale) => {
          it('renders exact number of points');
          it('all points have valid positions within plot area');
          it('point positions match expected data values');
          it('points have consistent dimensions');
          it('renders axes correctly');
        });
      });
    });
  });
});
```

## Test Matrix

### Config Dimensions

1. **Plot Types**: scatter, bar, histogram, line
2. **Plot Configs**: Combinations of scale, aggregate, group_by, sort options, etc.
3. **Project Configs**: Combinations of filter_expr, sorting, project-level group_by
4. **Data Types**:
   - X-axis: float, int, str, datetime
   - Y-axis: float, int
   - Group-by: str, bool
5. **Scales**:
   - Small: ~100 data points (timeout: 5s)
   - Medium: ~1,000 data points (timeout: 15s)
   - Large: ~10,000 data points (timeout: 30s)

### Plot Config Options

- `scale_x`: linear, log
- `scale_y`: linear, log
- `aggregate`: sum, mean, count, min, max
- `group_by`: with/without grouping
- `show_regression`: scatter only
- `bin_count`: histogram only (1, 10, 50, 100)
- `sort_by`/`sort_order`: bar only

### Project Config Options

- `filter_expr`: undefined, "status == 'success'", 'value > 0'
- `group_by`: undefined, ['category'], ['category', 'model']
- `sorting`: undefined, timestamp desc

### Validity Filtering

The `filterValidPlotConfigs()` function prunes invalid combinations:
- Regression: scatter only
- Non-default bin count: histogram only
- Sort options: bar only
- Aggregate: requires group_by

### Sampling

Use `PLOT_TEST_SAMPLE_RATE` to reduce test count for faster iteration:

```bash
# 25% of configs (evenly distributed)
PLOT_TEST_SAMPLE_RATE=25 npm test

# 10% of configs
PLOT_TEST_SAMPLE_RATE=10 npm test
```

Sampling uses evenly distributed selection (not just first N) for representative coverage.

## Assertions

### API Tests

Matrix tests verify:
- **Config Correctness**: All fields transformed correctly (snake_case → camelCase)
- **Data Correctness**: Count, structure, data types, value ranges
- **Data Preprocessing**: Field prefixing, entry merging, type preservation, null handling
  - **Project Config Preprocessing**: Filter expression validation, sorting order, project-level grouping, limit enforcement
- **Field Correctness**: Prefixed paths, correct type metadata, display types
- **Metadata Completeness**: Project name, timestamps, tokens

### Integration Tests

Matrix tests verify **exact** values, not just validity:

| Plot Type | Assertions |
|-----------|------------|
| **Scatter** | Exact point count, positions within tolerance, consistent radii |
| **Bar** | Exact bar count (unique categories), consistent widths, proportional heights |
| **Histogram** | Bin count in range, consistent widths, contiguous (no gaps), proportional heights |
| **Line** | Valid path (no NaN/Infinity), within plot bounds, segment count matches data |

## Running Tests

### All Tests

```bash
npm test
```

### Specific Test Files

```bash
# API tests
npm test -- src/tests/plot/api/

# Integration tests
npm test -- src/tests/plot/integration/

# Unit tests
npm test -- src/tests/plot/unit/

# Benchmarks
npm test -- src/tests/plot/benchmarks/
```

## Test Harnesses

### `plotCanvasTestHarness.tsx`

For testing `PlotCanvas` component directly without Zustand store.

**Use for:**
- Rendering correctness tests
- D3 SVG element verification
- API-generated plot data rendering

**Example:**
```tsx
const result = renderPlotCanvas({
  plotType: 'Scatter Plot',
  dataTypeConfig: { x_axis_type: 'float', y_axis_type: 'float', group_by_type: 'str' },
  scale: scaleOptions[0],
  deterministic: true, // Use deterministic data for precise assertions
});

await result.waitForPlot();

const points = result.getScatterPoints();
assertPointsHaveValidPositions(points);
```

### `plotTileTestHarness.tsx` (existing)

For testing plot tiles with Zustand store interactions.

**Use for:**
- UI behavior tests (settings panel, focus mode)
- Store state management tests
- Plot type transition tests

## Mock Data

### Type-Aware Generation

Mock data generators produce data based on `DataTypeConfig`:

```typescript
const logs = createMockLogs({
  dataTypeConfig: {
    x_axis_type: 'datetime',
    y_axis_type: 'float',
    group_by_type: 'str',
  },
  scale: { name: 'medium', count: 1000, skip: false, timeout: 15000 },
  includeNulls: true,
  includeEdgeCases: true,
  deterministic: false, // Random-like data
});
```

### Deterministic Data

For precise position assertions, use deterministic data:

```typescript
const deterministicData = createDeterministicMockLogs(
  dataTypeConfig,
  100 // count
);

// Returns:
// - logs: Array of logs with predictable values
// - expectedXValues: Pre-computed X values
// - expectedYValues: Pre-computed Y values
// - xDomain: { min, max }
// - yDomain: { min, max }
// - count: Total log count
```

### Supported Data Types

- **Numeric**: float, int
- **String**: str
- **Boolean**: bool
- **Temporal**: datetime, time, date, timedelta
- **Complex**: dict, list, set, tuple, Any
- **Special**: image, embedding

### Edge Cases (Auto-included)

- Null values
- Zero values
- Negative values
- Very large values (1e15, MAX_SAFE_INTEGER)
- Empty strings
- Future dates

## Calculation Utilities

`calculations.ts` provides helpers for computing expected pixel positions:

```typescript
import {
  calculateScatterPointPosition,
  calculateBarDimensions,
  calculateHistogramBinDimensions,
  calculateDomain,
  calculateExpectedPointCount,
  positionsAreClose,
  POSITION_TOLERANCE,
  DEFAULT_DIMENSIONS,
} from '../fixtures/calculations';

// Calculate expected point position
const expectedPos = calculateScatterPointPosition(
  xValue, yValue,
  xDomain, yDomain,
  'linear', 'linear'
);

// Compare with tolerance
expect(positionsAreClose(actualCx, expectedPos.cx, POSITION_TOLERANCE)).toBe(true);
```

## Unit Tests

### Available Unit Tests

| File | Tests |
|------|-------|
| `data.node.test.ts` | `getValue`, `hasProperty`, `inferDisplayType` |
| `axes.node.test.ts` | `generateTicks`, `reverseOrKeepDomain`, `checkLogScalability` |
| `tooltip.node.test.ts` | `tooltipTemplate` |
| `key.node.test.ts` | `keyTemplate` |

## Benchmarks

Benchmarks measure render time and DOM element counts across scales and configurations.

### Running Benchmarks

```bash
npm test -- src/tests/plot/benchmarks/
```

### Output

Results are logged to console with summaries grouped by plot type:

```
========================================
      RENDERING BENCHMARK SUMMARY
========================================

SCATTER:
  small: 45.23ms, 156 elements
  small (regression): 52.18ms, 162 elements
  medium: 312.45ms, 1056 elements
  ...
```

## Adding New Tests

### New Plot Type

1. Add type to `plotConfigOptions.type` in `configs.ts`
2. Update `filterValidPlotConfigs()` with type-specific rules
3. Create `newtype.browser.test.tsx` in `integration/`
4. Add harness helper methods in `plotCanvasTestHarness.tsx`
5. Add calculation helpers in `calculations.ts`
6. Add benchmark tests in `rendering.perf.browser.test.tsx`

### New Data Type

1. Add to `dataTypeOptions` in `configs.ts`
2. Add value generator in `mockData.ts` (both regular and deterministic)
3. Update `mapToDisplayType()` for field generation

### New Config Option

1. Add to appropriate options object in `configs.ts`
2. Update `generateAllPlotConfigs()` loops
3. Update `filterValidPlotConfigs()` validity rules
4. Update `plotConfigName()` for test naming
