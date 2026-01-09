import { describe, it, expect, vi } from 'vitest';
import { TILE_BUILD_AND_RENDER_CONFIGS } from '@/utils/interfaces/tileDependencies/config';

describe('Tile Dependency Config', () => {
  describe('Table tile checkInternalDataReadiness', () => {
    const tableConfig = TILE_BUILD_AND_RENDER_CONFIGS.Table;

    it('returns NOT ready when tableDataItem is missing', () => {
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') return undefined;
          if (key[0] === 'tableArguments') return { someTile: {} };
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      expect(result.isReady).toBe(false);
      expect(result.missingData).toContain('tableDataItem');
    });

    it('returns NOT ready when tableDataItem.isLoading is true', () => {
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') {
            return {
              isLoading: true, // Still loading!
              logs: [],
              fields: {},
            };
          }
          if (key[0] === 'tableArguments') return { someTile: {} };
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      expect(result.isReady).toBe(false);
      expect(result.missingData).toContain('tableDataItem (loading)');
    });

    it('returns ready when fields is empty and logs is empty (valid empty table)', () => {
      // Empty tables are valid for:
      // 1. Newly created tables
      // 2. Tables with context: null
      // 3. Tables where a filter returns no results
      // They should render the empty overlay, not stay as skeleton
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') {
            return {
              isLoading: false,
              logs: [],
              fields: {}, // Empty fields is OK - render empty state
            };
          }
          if (key[0] === 'tableArguments') return { someTile: {} };
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      expect(result.isReady).toBe(true);
      expect(result.missingData).toEqual([]);
    });

    it('returns ready when isLoading is false and fields exist', () => {
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') {
            return {
              isLoading: false,
              logs: [{ id: '1', entries: { col1: 'value' } }],
              fields: { col1: { fieldType: 'entry', dataType: 'str' } },
            };
          }
          if (key[0] === 'tableArguments') return { someTile: {} };
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      expect(result.isReady).toBe(true);
      expect(result.missingData).toEqual([]);
    });

    it('returns ready when logs is empty but fields exist (valid empty table)', () => {
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') {
            return {
              isLoading: false,
              logs: [], // Empty logs is fine if fields exist
              fields: { col1: { fieldType: 'entry', dataType: 'str' } },
            };
          }
          if (key[0] === 'tableArguments') return { someTile: {} };
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      expect(result.isReady).toBe(true);
      expect(result.missingData).toEqual([]);
    });

    it('returns NOT ready when tableArguments is missing', () => {
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') {
            return {
              isLoading: false,
              logs: [{ id: '1', entries: { col1: 'value' } }],
              fields: { col1: { fieldType: 'entry', dataType: 'str' } },
            };
          }
          if (key[0] === 'tableArguments') return undefined; // Missing!
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      expect(result.isReady).toBe(false);
      expect(result.missingData).toContain('tableArguments');
    });

    it('returns READY when contextNotFound is true (deleted context - should show error overlay)', () => {
      // When a context returns 404, getLogs returns { contextNotFound: true }
      // The tile should be considered "ready" so it renders an error overlay
      // instead of spinning forever waiting for data that will never come
      const mockQueryClient = {
        getQueryData: vi.fn((key: string[]) => {
          if (key[0] === 'tableDataItem') {
            return {
              isLoading: false,
              logs: [],         // Empty - context doesn't exist
              fields: {},       // Empty - context doesn't exist
              contextNotFound: true,  // This is the key flag!
            };
          }
          if (key[0] === 'tableArguments') return { someTile: {} };
          return undefined;
        }),
      };

      const result = tableConfig.checkInternalDataReadiness('tile-1', 'tab-1', mockQueryClient);

      // Should be ready so the tile can render an error message
      expect(result.isReady).toBe(true);
      expect(result.missingData).toEqual([]);
    });
  });
});

