# Usage Page Architecture

This document outlines the architecture and design decisions for the Usage page, which displays LLM credit usage as a bar chart visualization.

## Overview

The Usage page allows users to track their `billed_cost` over time with various filters (user scope, assistant, date range, granularity). It follows a modular, testable architecture with clear separation of concerns.

## Directory Structure

```
src/
├── app/(home)/usage/
│   ├── page.tsx              # Server component - fetches data, creates bound actions
│   └── README.md             # This file
├── components/Pages/Usage/
│   ├── Main.tsx              # Client orchestrator - combines all usage components
│   ├── UsageChart.tsx        # Bar chart wrapper using PlotCanvas
│   ├── UsageSummaryCards.tsx # Summary statistics (total, average, peak)
│   └── Filters/
│       ├── index.ts          # Barrel export
│       ├── UsageFiltersBar.tsx    # Filter container
│       ├── AssistantFilter.tsx    # Assistant dropdown
│       ├── UserScopeFilter.tsx    # User/org scope dropdown
│       ├── GranularityFilter.tsx  # Time granularity dropdown
│       └── TimeframeFilter.tsx    # Date range picker
├── hooks/Usage/
│   ├── useUsageFilters.ts    # Filter state management + computed values
│   ├── useUsageData.ts       # Data fetching with React Query
│   ├── useUsageSummary.ts    # Summary calculations
│   └── useUsageChartConfig.ts # PlotCanvas configuration
├── lib/usage/
│   ├── actions.ts            # Server actions (bound to API key)
│   ├── api.ts                # Orchestra API client with retry logic
│   ├── context.ts            # Context path utilities
│   └── transforms.ts         # API response transformations
├── utils/usage/
│   ├── dateUtils.ts          # Date formatting/parsing
│   ├── filterExpressions.ts  # Filter expression builders
│   └── formatters.ts         # Currency/number formatters
├── types/
│   └── usage.ts              # TypeScript interfaces
└── tests/usage/
    ├── unit/                 # Node.js unit tests
    ├── integration/          # Browser integration tests
    ├── api/                  # API integration tests
    └── mocks/                # Mock data factories
```

## Architecture

### Server/Client Boundary

```
┌─────────────────────────────────────────────────────────────────┐
│                        SERVER (page.tsx)                         │
│  • Authenticates user                                           │
│  • Fetches assistants list                                      │
│  • Fetches org members (for admins)                             │
│  • Creates bound server actions (API key in closure)            │
│  • Determines user role (admin/member)                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Main.tsx)                         │
│  • Manages filter state via useUsageFilters                     │
│  • Fetches usage data via useUsageData                          │
│  • Calculates summaries via useUsageSummary                     │
│  • Renders UI components                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Interaction
      │
      ▼
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Filter       │────▶│ useUsageFilters │────▶│ filterExpression │
│ Components   │     │ (state)         │     │ contextPath      │
└──────────────┘     └─────────────────┘     └──────────────────┘
                                                      │
                                                      ▼
┌──────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ UsageChart   │◀────│ useUsageData    │◀────│ Server Action    │
│ SummaryCards │     │ (React Query)   │     │ (API call)       │
└──────────────┘     └─────────────────┘     └──────────────────┘
```

## Key Design Decisions

### 1. ID-Based Filtering (Not Name-Based)

**Problem**: Using concatenated names in context paths (e.g., `JohnDoe/AssistantBot/Events/LLM`) is fragile:

- Two users could have the same concatenated name
- Names can change
- Special characters in names cause issues

**Solution**: Always use `All/Events/LLM` as the context path and filter via `_user_id` and `_assistant_id` fields in the filter expression.

```typescript
// Before (fragile):
contextPath = `${userName}/${assistantName}/Events/LLM`;

// After (robust):
contextPath = 'All/Events/LLM';
filterExpression = "... and _user_id == 'user_123' and _assistant_id == 'asst_456'";
```

These `_user_id` and `_assistant_id` fields are injected by Unity's `log_utils._inject_private_fields()` when logging LLM events.

### 2. Bound Server Actions

**Problem**: API keys must never be exposed to the client.

**Solution**: Create server actions with the API key captured in a closure:

```typescript
// Server-side (page.tsx)
const usageActions = await createUsageActions(apiKey);

// Client-side (Main.tsx)
const { data } = useUsageData({ usageActions, ... });
```

The `usageActions` object contains functions that internally use the API key but never expose it.

### 3. Dynamic Assistant Filtering

**Problem**: When viewing a specific user's usage, the assistant dropdown should only show that user's assistants.

**Solution**: Filter the assistants list based on `userScope` and `selectedUserId`:

```typescript
const filteredAssistants = useMemo(() => {
  if (filters.userScope === 'org') return assistants;

  const targetUserId =
    filters.userScope === 'member' && filters.selectedUserId
      ? filters.selectedUserId
      : currentUserId;

  return assistants.filter((a) => a.userId === targetUserId);
}, [assistants, filters.userScope, filters.selectedUserId, currentUserId]);
```

### 4. Pre-Aggregated Data from Backend

**Problem**: Aggregating millions of log entries client-side is inefficient.

**Solution**: Use Orchestra's `/v0/logs/metric/sum` endpoint which returns pre-aggregated data grouped by a time column (e.g., `time_day`).

```typescript
// Request
POST /v0/logs/metric/sum
{
  context: "All/Events/LLM",
  metric: "billed_cost",
  group_by_column: "time_day",
  filter_expression: "event_timestamp >= '2026-01-01' and ..."
}

// Response
{
  sums: [
    { time_day: "2026-01-01", billed_cost: 12.50 },
    { time_day: "2026-01-02", billed_cost: 8.75 },
    ...
  ]
}
```

### 5. Error Obfuscation

**Problem**: Backend error messages may contain sensitive information.

**Solution**: Show generic, user-friendly error messages:

```typescript
// useUsageData.ts
if (result.detail) {
  console.error('[useUsageData] API error:', result.detail);
  setError('Unable to load usage data. Please try again.');
}
```

### 6. Modular Hook Architecture

Each concern is isolated in its own hook for testability:

| Hook                  | Responsibility                                              |
| --------------------- | ----------------------------------------------------------- |
| `useUsageFilters`     | Filter state, computed `filterExpression` and `contextPath` |
| `useUsageData`        | Data fetching with React Query, loading/error states        |
| `useUsageSummary`     | Calculate total, average, peak from data                    |
| `useUsageChartConfig` | Transform data to PlotCanvas format                         |

### 7. Constant Context Path

The context path is now a constant `All/Events/LLM` for all queries. This simplifies the architecture:

```typescript
// lib/usage/context.ts
export const LLM_EVENTS_CONTEXT = 'All/Events/LLM';
```

All filtering (by user, assistant, date range) is done via the filter expression.

## User Scope Logic

| Scope    | Filter Expression                | Assistants Shown       |
| -------- | -------------------------------- | ---------------------- |
| `self`   | `_user_id == '{currentUserId}'`  | Current user's only    |
| `member` | `_user_id == '{selectedUserId}'` | Selected member's only |
| `org`    | (no user filter)                 | All org assistants     |

Non-admins are always forced to `self` scope regardless of what they request.

## Testing Strategy

### Unit Tests (`*.node.test.ts`)

- Run in Node.js
- Test hooks, utilities, transformations
- Use `@testing-library/react` for hooks
- MSW for API mocking

### Browser Tests (`*.browser.test.tsx`)

- Run in real Chromium via Playwright
- Test component rendering and interactions
- Use `@testing-library/react` + `userEvent`

### Mock Data Factories

Located in `tests/usage/mocks/data.ts`:

- `createMockUsageDataPoint()` - Single data point
- `createMockUsageData()` - Array of data points
- `createMockAssistantList()` - Assistants with `userId`
- `createMockOrgMemberList()` - Organization members
- `createMockUsageActions()` - Mock server actions

## Dependencies

- **PlotCanvas**: D3-based charting component from `@/components/Common/Plot`
- **DateRangeSelector**: Date picker from `@/components/Common/Time`
- **React Query**: Data fetching and caching
- **Radix UI**: Select components for filters

## Future Considerations

1. **Caching**: Consider caching usage data with appropriate TTL
2. **Export**: Add CSV/PDF export functionality
3. **Drill-down**: Click on bar to see detailed breakdown
4. **Alerts**: Set up cost thresholds and notifications
5. **Comparison**: Compare usage across time periods
