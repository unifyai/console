import { describe, it, expect } from 'vitest';
import { buildTileDependencyGraph } from '@/utils/interfaces/tileDependencies';
import { initTile, type Tile } from '@/contexts/slices/selectors/tile';

function makeTile(id: string, name: string, type: Tile['type'], extra: Partial<Tile> = {}): Tile {
  return initTile(id, {
    name,
    type,
    ...extra,
  }) as Tile;
}

describe('tileDependencies - buildTileDependencyGraph', () => {
  it('builds an acyclic dependency graph and sorts tiles in dependency order', () => {
    // TableA has no external dependencies
    const tableA = makeTile('table-a', 'TableA', 'Table');

    // ViewB depends on TableA via its table property
    const viewB = makeTile('view-b', 'ViewB', 'View', { table: 'TableA' });

    // ViewC depends on ViewB via its table property (chain: C -> B -> A)
    const viewC = makeTile('view-c', 'ViewC', 'View', { table: 'ViewB' });

    const { sortedTileIds, dependencyMap, circularDependencies } = buildTileDependencyGraph([
      tableA,
      viewB,
      viewC,
    ]);

    // No cycles in this simple chain
    expect(circularDependencies).toHaveLength(0);

    // Order must respect dependencies: A before B before C
    expect(sortedTileIds).toEqual(['table-a', 'view-b', 'view-c']);

    // Dependency map wiring
    expect(dependencyMap.get('view-b')?.dependencies.has('table-a')).toBe(true);
    expect(dependencyMap.get('view-c')?.dependencies.has('view-b')).toBe(true);
    expect(dependencyMap.get('table-a')?.dependents.has('view-b')).toBe(true);
    expect(dependencyMap.get('view-b')?.dependents.has('view-c')).toBe(true);
  });

  it('detects a simple cycle and prunes circular edges', () => {
    // Two view tiles referencing each other by name create a cycle
    const tileFoo = makeTile('tile-foo', 'Foo', 'View', { table: 'Bar' });
    const tileBar = makeTile('tile-bar', 'Bar', 'View', { table: 'Foo' });

    const { sortedTileIds, dependencyMap, circularDependencies } = buildTileDependencyGraph(
      [tileFoo, tileBar],
      // Keep defaults so circular detection and logging are enabled
      {}
    );

    // A single cycle Foo <-> Bar should be reported
    expect(circularDependencies.length).toBe(1);
    const cycle = circularDependencies[0];
    // Cycle will look like ['tile-foo', 'tile-bar', 'tile-foo'] (order not critical)
    const uniqueIds = new Set(cycle);
    expect(uniqueIds.has('tile-foo')).toBe(true);
    expect(uniqueIds.has('tile-bar')).toBe(true);

    // After pruning cycles, dependency sets between the two tiles should be empty or acyclic
    const fooDeps = dependencyMap.get('tile-foo')?.dependencies ?? new Set();
    const barDeps = dependencyMap.get('tile-bar')?.dependencies ?? new Set();
    expect(fooDeps.has('tile-bar')).toBe(false);
    expect(barDeps.has('tile-foo')).toBe(false);

    // Topological sort still returns both tiles without infinite recursion
    expect(sortedTileIds.sort()).toEqual(['tile-bar', 'tile-foo'].sort());
  });

  it('respects maxDependencyDepth and can skip recording very deep cycles', () => {
    const tileFoo = makeTile('tile-foo', 'Foo', 'View', { table: 'Bar' });
    const tileBar = makeTile('tile-bar', 'Bar', 'View', { table: 'Foo' });

    const { circularDependencies } = buildTileDependencyGraph([tileFoo, tileBar], {
      maxDependencyDepth: 0,
    });

    // With maxDepth = 0, DFS bails out immediately and does not record cycles
    expect(circularDependencies).toHaveLength(0);
  });
});
