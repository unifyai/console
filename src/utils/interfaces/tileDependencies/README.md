# Tile Dependency Management System

A comprehensive, modular system for managing tile dependencies, data building, and rendering in the @Interfaces components. This system ensures that dependent tiles (like plots) wait for their dependencies (like tables) to be fully built before starting their own data building process.

## Debug Logging

To enable detailed debug logging for tile dependencies, set the environment variable:

```bash
NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true
```

This will enable comprehensive logging including:

- Dependency graph building and sorting
- External dependency checking with emoji indicators (🔍 🚀 ⏳ ✅ ❌)
- Internal data readiness checking
- Tab arguments building progress
- Tile render state summaries
- Real-time dependency monitoring with refetch intervals

**Example debug output:**

```
🔍 [externalDependenciesQuery] Checking external dependencies for Plot1: [Table1, Table2]
🔍 [externalDependenciesQuery] Dependency "Table1" (Table) data check: { isReady: true, missingData: [], tileId: "table-123" }
⏳ [externalDependenciesQuery] External dependency "Table1" not ready - missing: [tableDataItem]
✅ [externalDependenciesQuery] External dependency "Table2" ready!
🔍 [externalDependenciesQuery] Final result for Plot1: { isReady: true, missingDependencies: [] }
🎯 [useEnsureTileDataBeforeRender] SUMMARY for Plot1 (Plot): { shouldStartBuilding: false, canRender: false, ... }
```

## Architecture Overview

The system uses a **unified configuration approach** combined with **reactive query-based dependency monitoring** where each tile type has a single comprehensive configuration that handles:

- External dependency resolution with real-time monitoring
- Internal data requirements checking with automatic refetching
- Building prerequisites and readiness logic
- Rendering readiness determination
- Data building hook management

### Key Components

1. **Unified Configuration** (`config.ts`) - Single source of truth for all tile behavior
2. **Dependency Manager** (`dependencyManager.ts`) - Core logic with topological sorting and reactive monitoring
3. **Types** (`types.ts`) - TypeScript interfaces and type definitions
4. **Reactive Query System** - Uses React Query for real-time dependency and data monitoring

## Core Concepts

### Tile Types and Dependencies

- **Independent Tiles**: Table, Editor, Terminal - can render immediately after their own data is built
- **Dependent Tiles**: Plot, View - require other tiles' data before they can start building

### Building vs Rendering

- **Build Readiness**: When a tile should START building its data
- **Render Readiness**: When a tile should SHOW its content (remove skeleton)

### Dependency Types

- **External Dependencies**: Other tiles this tile depends on
- **Internal Dependencies**: The tile's own data requirements (tableDataItem, plotArguments, etc.)

### Reactive Monitoring

The system uses **reactive queries** that automatically monitor dependency states:

- `staleTime: 0` - Always check fresh data
- `refetchInterval: 1000` - Re-check every second to catch dependency changes
- Automatic re-evaluation when dependencies change

## Usage

### Basic Usage in Components

```typescript
import {
  useDependencyAwareSortedTilesForTab,
  useEnsureTileDataBeforeRender,
} from '@/utils/tileDependencies';

// In Tab component - get dependency-sorted tiles
const { sortedTiles, dependencyGraph } = useDependencyAwareSortedTilesForTab(tabId);

// In TileRenderer component - ensure data and check render state
const {
  renderState,
  canRender,
  isBuilding,
  shouldStartBuilding,
  internalDataReady,
  externalDependenciesReady,
} = useEnsureTileDataBeforeRender(tileId, tabId, interfaceId, projectId, actions);
```

### Tile Configuration

Each tile type has a unified configuration in `TILE_BUILD_AND_RENDER_CONFIGS`:

```typescript
Plot: {
  tileType: 'Plot',
  isIndependent: false,
  description: 'Dependent tile - requires table tiles referenced in x_axis, y_axis, plot_group_by',

  // External dependency resolution
  getExternalDependencies: getPlotDependencies,

  // Building prerequisites
  needsTabArguments: true,
  needsExternalDependencies: true,

  // Building readiness logic
  shouldStartBuilding: (tabArgumentsReady, externalDependenciesReady) =>
    tabArgumentsReady && externalDependenciesReady,

  // Internal data requirements checking
  checkInternalDataReadiness: (tileId, tabId, queryClient) => {
    const plotDataItem = queryClient.getQueryData(['plotDataItem', tileId]);
    const plotArguments = queryClient.getQueryData(['plotArguments', tabId]);

    const missingData: string[] = [];
    if (!plotDataItem) missingData.push('plotDataItem');
    if (!plotArguments) missingData.push('plotArguments');

    return {
      isReady: missingData.length === 0,
      missingData
    };
  },

  // Data building hook management
  getDataBuildingHooks: (tileId, tabId, interfaceId, projectId, shouldStartBuilding, actions) => {
    return { queries: [], isBuilding: false };
  }
}
```

## API Reference

### Main Hooks

#### `useDependencyAwareSortedTilesForTab(tabId, config?)`

Returns tiles sorted by dependencies using topological sort with efficient store access.

**Returns:**

```typescript
{
  sortedTiles: Tile[];
  dependencyGraph: DependencyGraphResult;
}
```

#### `useEnsureTabArguments(tabId, projectId, actions)`

Ensures tab-level arguments (tableArguments and plotArguments) are built before individual tiles can render.

**Returns:**

```typescript
UseQueryResult<{
  tableArguments: TableArguments;
  plotArguments: PlotArguments;
}>;
```

#### `useEnsureTileDataBeforeRender(tileId, tabId, interfaceId, projectId, actions)`

Ensures tile data is built and determines render readiness using reactive monitoring.

**Returns:**

```typescript
{
  // Building-related state
  config: TileBuildAndRenderConfig;
  tabArgumentsQuery: UseQueryResult | null;
  tableDataQuery: UseQueryResult | null;
  plotDataQuery: UseQueryResult | null;
  shouldStartBuilding: boolean;
  isBuilding: boolean;

  // Rendering-related state (unified)
  renderState: TileRenderState;
  canRender: boolean;
  internalDataReady: boolean;
  externalDependenciesReady: boolean;
}
```

### Internal Reactive Hooks

#### `useExternalDependenciesQuery(tile, tabId, config)` (Internal)

Creates a reactive query that monitors external dependencies with automatic refetching.

**Features:**

- Real-time monitoring with 1-second intervals
- Emoji-based debug logging
- Automatic re-evaluation when dependencies change

#### `useInternalDataQuery(tile, tileId, tabId, tileType, config)` (Internal)

Creates a reactive query that monitors internal data requirements.

**Features:**

- Automatic data freshness checking
- Real-time monitoring with 1-second intervals
- Unified data readiness checking across tile types

### Configuration Functions

#### `getTileBuildAndRenderConfig(tileType)`

Get the unified configuration for a specific tile type.

#### `isIndependentTileType(tileType)`

Check if a tile type is independent (doesn't need external dependencies).

#### `getIndependentTileTypes()` / `getDependentTileTypes()`

Get arrays of independent or dependent tile types.

## Dependency Flow

### Sequential Building Process with Reactive Monitoring

1. **Tab Arguments**: Build `tableArguments` and `plotArguments` for the entire tab
2. **Reactive Monitoring**: Start real-time monitoring of all dependencies
3. **Independent Tiles**: Table, Editor, Terminal tiles start building immediately
4. **Dependent Tiles**: Plot and View tiles wait for their specific dependencies to complete
5. **Rendering**: Each tile shows content only when all its data is ready

### Example Flow with Reactive Updates

```
Tab Arguments Building
├── Reactive monitoring starts for all tiles
├── Table1 starts building (independent)
├── Table2 starts building (independent)
├── Editor starts building (independent)
└── Plot waits for Table1, Table2 (monitored every 1s)

Table1 completes → Reactive query detects change
Table2 completes → Reactive query detects change
Plot dependencies satisfied → Plot starts building
Plot completes → Plot renders
```

## Reactive Architecture

### Real-Time Dependency Monitoring

The system uses React Query's reactive capabilities for real-time monitoring:

```typescript
// External dependencies monitored with reactive queries
const externalDependenciesQuery = useQuery({
  queryKey: ['externalDependencies', tile?.id, tabId],
  staleTime: 0, // Always check fresh
  refetchInterval: 1000, // Re-check every second
  refetchOnWindowFocus: false,
});

// Internal data monitored with reactive queries
const internalDataQuery = useQuery({
  queryKey: ['internalData', tileId, tabId],
  staleTime: 0, // Always check fresh
  refetchInterval: 1000, // Re-check every second
  refetchOnWindowFocus: false,
});
```

### Benefits of Reactive Approach

- **Automatic Updates**: Dependencies are checked automatically without manual triggers
- **Real-Time Responsiveness**: Changes are detected within 1 second
- **Efficient Caching**: React Query handles caching and deduplication
- **Simplified Logic**: No complex memoization or manual dependency tracking needed

## Error Handling

### Circular Dependencies

The system automatically detects and removes circular dependencies using depth-first search:

```typescript
const dependencyGraph = buildTileDependencyGraph(tiles, {
  enableCircularDependencyDetection: true,
  maxDependencyDepth: 10,
});
```

### Missing Dependencies

When a tile references a dependency that doesn't exist, it's logged with emoji indicators and the tile continues without that dependency:

```
❌ [externalDependenciesQuery] Dependency tile "NonExistentTable" not found for Plot1
```

### Data Building Failures

React Query handles retries and error states for data building operations, with the reactive system continuing to monitor for recovery.

## Performance Optimizations

### Efficient Store Access

- Uses direct store selectors instead of React hooks for tile access
- Avoids unnecessary re-renders with stable references
- Memoizes dependency graph computation

### Reactive Query Optimizations

- Uses React Query's built-in caching and deduplication
- Conditional hook enabling based on build readiness
- Prevents unnecessary network calls with smart query keys
- Automatic cleanup of unused queries

### Modular Dependency Checking

- Each tile type defines its own data requirements
- Extensible system for adding new tile types
- Avoids hardcoded if/else chains
- Unified configuration reduces code duplication

## Debugging

### Enhanced Debug Logging

Enable comprehensive logging by setting the environment variable:

```bash
NEXT_PUBLIC_DEBUG_TILE_DEPENDENCIES=true
```

### Console Output with Emojis

The system provides detailed console logging with emojis for easy identification:

```
🔍 [externalDependenciesQuery] Checking external dependencies for Plot1 (Plot): [Table1, Table2]
🔍 [externalDependenciesQuery] Dependency "Table1" (Table) data check: { isReady: true, missingData: [], tileId: "table-123" }
✅ [externalDependenciesQuery] External dependency "Table1" ready!
✅ [externalDependenciesQuery] External dependency "Table2" ready!
🔍 [externalDependenciesQuery] Final result for Plot1: { isReady: true, missingDependencies: [] }
🎯 [useEnsureTileDataBeforeRender] SUMMARY for Plot1 (Plot): { shouldStartBuilding: true, canRender: true, ... }
[useEnsureTabArguments] Building arguments for tab tab-123
[useEnsureTabArguments] Built arguments for tab tab-123: tableArguments keys: 2 plotArguments keys: 1
```

### Debug Categories

- **🔍 Dependency Checking**: External and internal dependency monitoring
- **⏳ Waiting States**: When tiles are waiting for dependencies
- **✅ Success States**: When dependencies are satisfied
- **❌ Error States**: When dependencies are missing or failed
- **🎯 Summary States**: Overall tile render state summaries
- **🚀 Building States**: When tiles start building data

### Adding New Tile Types

To add support for a new tile type:

1. Add the tile type to `TileType` union in `types.ts`
2. Add configuration to `TILE_BUILD_AND_RENDER_CONFIGS` in `config.ts`
3. Implement the required methods:
   - `getExternalDependencies`
   - `checkInternalDataReadiness`
   - `shouldStartBuilding`
   - `getDataBuildingHooks`

## Best Practices

1. **Use `useDependencyAwareSortedTilesForTab()`** for most efficient store access
2. **Enable debug logging** during development for troubleshooting
3. **Handle loading states** properly with `isBuilding` and `canRender` flags
4. **Implement proper error boundaries** around tile rendering
5. **Test circular dependency scenarios** when adding complex dependencies
6. **Monitor React Query DevTools** to understand reactive query behavior
7. **Use the reactive system** instead of manual dependency checking

## Future Enhancements

- Support for dynamic dependencies that change based on tile configuration
- Dependency caching across tab switches
- Advanced error recovery strategies
- Configurable refetch intervals per tile type
- WebSocket-based real-time updates instead of polling
- Dependency change notifications and callbacks
