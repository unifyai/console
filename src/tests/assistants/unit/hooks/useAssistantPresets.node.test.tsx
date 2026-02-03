/**
 * Tests for useAssistantPresets hook - Lazy Loading Behavior
 *
 * These tests verify that preset data is processed lazily (only when needed)
 * rather than eagerly on component mount.
 *
 * Key behaviors tested:
 * 1. Presets are NOT processed when enabled=false
 * 2. Presets ARE processed when enabled=true
 * 3. Presets are processed only once when enabled toggles true multiple times
 * 4. Filter functionality works correctly when enabled
 * 5. Backward compatibility when no options provided
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAssistantPresets } from '@/hooks/Assistants/useAssistantPresets';

describe('useAssistantPresets - Lazy Loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Lazy Loading Behavior', () => {
    it(
      'should NOT process presets when enabled is false',
      {
        meta: {
          alias: 'Presets-LazyDisabled',
          scenario: 'Hook initialized with enabled=false',
          behavior: 'Should not process or shuffle presets',
        },
      },
      async () => {
        // Arrange & Act
        const { result } = renderHook(() => useAssistantPresets({ enabled: false }));

        // Assert - presets should be empty/uninitialized
        expect(result.current.allAssistantPresets).toEqual([]);
        expect(result.current.displayedPresets).toEqual([]);
        expect(result.current.currentFilteredPresets).toEqual([]);
        expect(result.current.hasInitialized).toBe(false);
      }
    );

    it(
      'should process presets when enabled is true',
      {
        meta: {
          alias: 'Presets-LazyEnabled',
          scenario: 'Hook initialized with enabled=true',
          behavior: 'Should process and shuffle presets',
        },
      },
      async () => {
        // Arrange & Act
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        // Assert - presets should be populated
        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
        });
        expect(result.current.displayedPresets.length).toBeGreaterThan(0);
        expect(result.current.hasInitialized).toBe(true);
      }
    );

    it(
      'should process presets when enabled changes from false to true',
      {
        meta: {
          alias: 'Presets-LazyToggle',
          scenario: 'Hook starts disabled, then becomes enabled',
          behavior: 'Should process presets only when enabled becomes true',
        },
      },
      async () => {
        // Arrange - start with enabled=false
        const { result, rerender } = renderHook(({ enabled }) => useAssistantPresets({ enabled }), {
          initialProps: { enabled: false },
        });

        // Verify not initialized
        expect(result.current.allAssistantPresets).toEqual([]);
        expect(result.current.hasInitialized).toBe(false);

        // Act - enable the hook
        rerender({ enabled: true });

        // Assert - should now be initialized
        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
          expect(result.current.hasInitialized).toBe(true);
        });
      }
    );

    it(
      'should NOT re-process when enabled toggles true multiple times',
      {
        meta: {
          alias: 'Presets-LazyCache',
          scenario: 'Hook enabled multiple times (e.g., dialog opens/closes)',
          behavior: 'Should maintain the same shuffled order (cached)',
        },
      },
      async () => {
        // Arrange
        const { result, rerender } = renderHook(({ enabled }) => useAssistantPresets({ enabled }), {
          initialProps: { enabled: false },
        });

        // First enable - should initialize
        rerender({ enabled: true });
        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
        });

        // Capture the order
        const firstOrder = result.current.allAssistantPresets.map((p) => p.firstName);

        // Disable
        rerender({ enabled: false });

        // Enable again - should maintain same order (cached)
        rerender({ enabled: true });

        const secondOrder = result.current.allAssistantPresets.map((p) => p.firstName);

        // Assert - order should be the same (not re-shuffled)
        expect(firstOrder).toEqual(secondOrder);
        expect(result.current.hasInitialized).toBe(true);
      }
    );

    it(
      'should provide available filter options only when enabled',
      {
        meta: {
          alias: 'Presets-FilterOptionsLazy',
          scenario: 'Hook disabled vs enabled',
          behavior: 'Filter options should only be computed when enabled',
        },
      },
      async () => {
        // Arrange - start disabled
        const { result, rerender } = renderHook(({ enabled }) => useAssistantPresets({ enabled }), {
          initialProps: { enabled: false },
        });

        // Assert - filter options should be minimal/empty when disabled
        expect(result.current.availableNationalities).toEqual(['all']);
        expect(result.current.availableGenders).toEqual(['all']);
        expect(result.current.availableLanguages).toEqual(['all']);

        // Act - enable
        rerender({ enabled: true });

        // Assert - filter options should now be populated
        await waitFor(() => {
          expect(result.current.availableNationalities.length).toBeGreaterThan(1);
        });
        expect(result.current.availableGenders.length).toBeGreaterThan(1);
      }
    );
  });

  describe('Backward Compatibility', () => {
    it(
      'should default to enabled=true for backward compatibility when no options provided',
      {
        meta: {
          alias: 'Presets-BackwardCompat',
          scenario: 'Hook called without options parameter',
          behavior: 'Should initialize immediately (existing behavior)',
        },
      },
      async () => {
        // Arrange & Act - call without options (simulating old usage)
        const { result } = renderHook(() => useAssistantPresets());

        // Assert - should be initialized immediately for backward compatibility
        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
        });
        expect(result.current.hasInitialized).toBe(true);
      }
    );
  });

  describe('Filter Functionality', () => {
    it(
      'should filter presets by age bracket when enabled',
      {
        meta: {
          alias: 'Presets-AgeFilter',
          scenario: 'User selects age filter',
          behavior: 'Should filter displayed presets by age range',
        },
      },
      async () => {
        // Arrange
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
        });

        const totalCount = result.current.allAssistantPresets.length;

        // Act - filter by age 26-35
        act(() => {
          result.current.setPresetAgeFilter('26-35');
        });

        // Assert - filtered count should be less than or equal to total
        await waitFor(() => {
          // Should have some presets in this range but not all
          expect(result.current.currentFilteredPresets.length).toBeLessThanOrEqual(totalCount);
        });

        // All filtered presets should have age in range
        result.current.currentFilteredPresets.forEach((preset) => {
          if (preset.age) {
            expect(preset.age).toBeGreaterThanOrEqual(26);
            expect(preset.age).toBeLessThanOrEqual(35);
          }
        });
      }
    );

    it(
      'should filter presets by nationality when enabled',
      {
        meta: {
          alias: 'Presets-NationalityFilter',
          scenario: 'User selects nationality filter',
          behavior: 'Should filter displayed presets by nationality',
        },
      },
      async () => {
        // Arrange
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        await waitFor(() => {
          expect(result.current.availableNationalities.length).toBeGreaterThan(1);
        });

        // Get a nationality that exists (skip 'all')
        const testNationality = result.current.availableNationalities.find((n) => n !== 'all');
        if (!testNationality) {
          // Skip if no nationalities available
          return;
        }

        // Act - filter by nationality
        act(() => {
          result.current.setPresetNationalityFilter(testNationality);
        });

        // Assert - all filtered presets should match nationality
        await waitFor(() => {
          result.current.currentFilteredPresets.forEach((preset) => {
            expect(preset.nationality).toBe(testNationality);
          });
        });
      }
    );

    it(
      'should filter presets by gender when enabled',
      {
        meta: {
          alias: 'Presets-GenderFilter',
          scenario: 'User selects gender filter',
          behavior: 'Should filter displayed presets by gender',
        },
      },
      async () => {
        // Arrange
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        await waitFor(() => {
          expect(result.current.availableGenders.length).toBeGreaterThan(1);
        });

        // Act - filter by male
        act(() => {
          result.current.setPresetGenderFilter('male');
        });

        // Assert - all filtered presets should be male
        await waitFor(() => {
          result.current.currentFilteredPresets.forEach((preset) => {
            expect(preset.gender?.toLowerCase()).toBe('male');
          });
        });
      }
    );

    it(
      'should reset filters to show all when set back to "all"',
      {
        meta: {
          alias: 'Presets-ResetFilters',
          scenario: 'User clears filters',
          behavior: 'Should show all presets again',
        },
      },
      async () => {
        // Arrange
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
        });

        const totalCount = result.current.allAssistantPresets.length;

        // Apply filter
        act(() => {
          result.current.setPresetGenderFilter('male');
        });

        await waitFor(() => {
          expect(result.current.currentFilteredPresets.length).toBeLessThan(totalCount);
        });

        // Act - reset filter
        act(() => {
          result.current.setPresetGenderFilter('all');
        });

        // Assert - should show all again
        await waitFor(() => {
          expect(result.current.currentFilteredPresets.length).toBe(totalCount);
        });
      }
    );
  });

  describe('Pagination', () => {
    it(
      'should load more presets when requested',
      {
        meta: {
          alias: 'Presets-LoadMore',
          scenario: 'User scrolls/clicks load more',
          behavior: 'Should increase displayed presets count',
        },
      },
      async () => {
        // Arrange
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        await waitFor(() => {
          expect(result.current.displayedPresets.length).toBeGreaterThan(0);
        });

        const initialDisplayed = result.current.displayedPresets.length;

        // Only test if there are more to load
        if (!result.current.canLoadMorePresets) {
          return;
        }

        // Act - load more
        act(() => {
          result.current.loadMorePresets();
        });

        // Wait for loading to complete (simulated delay)
        await waitFor(
          () => {
            expect(result.current.displayedPresets.length).toBeGreaterThan(initialDisplayed);
          },
          { timeout: 500 }
        );
      }
    );

    it(
      'should indicate when more presets can be loaded',
      {
        meta: {
          alias: 'Presets-CanLoadMore',
          scenario: 'Checking if more presets available',
          behavior: 'canLoadMorePresets should reflect availability',
        },
      },
      async () => {
        // Arrange
        const { result } = renderHook(() => useAssistantPresets({ enabled: true }));

        await waitFor(() => {
          expect(result.current.allAssistantPresets.length).toBeGreaterThan(0);
        });

        // Assert - if displayed < total, canLoadMore should be true
        if (result.current.displayedPresets.length < result.current.currentFilteredPresets.length) {
          expect(result.current.canLoadMorePresets).toBe(true);
        } else {
          expect(result.current.canLoadMorePresets).toBe(false);
        }
      }
    );
  });
});
