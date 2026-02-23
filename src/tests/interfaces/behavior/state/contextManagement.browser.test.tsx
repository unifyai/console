/**
 * P3: Context Management Behavior Tests
 *
 * Tests behaviors I1-I5 from BEHAVIORS.md:
 * - I1: Set global context (interface/tab level)
 * - I2: Set tile context (tile-level override)
 * - I3: Create context
 * - I4: Context inheritance (interface → tab → tile)
 * - I5: Clear context
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  renderContextSelector,
  ContextSelectorTestResult,
} from '../fixtures/contextSelectorTestHarness';

describe('P3-I: Context Management', () => {
  let result: ContextSelectorTestResult;

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // I1: Set Global Context
  // ==========================================================================
  describe('I1: Set global context', () => {
    it('can set interface-level context', async () => {
      result = renderContextSelector({
        initialContexts: ['production', 'staging', 'development'],
      });

      // Initially no context
      expect(result.getInterfaceContext()).toBeNull();

      // Set interface context
      await result.setInterfaceContext('production');

      // Verify context is set
      expect(result.getInterfaceContext()).toBe('production');
    });

    it('can set tab-level context', async () => {
      result = renderContextSelector({
        initialContexts: ['production', 'staging'],
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1'] }],
      });

      // Initially no context
      expect(result.getTabContext('tab-1')).toBeNull();

      // Set tab context
      await result.setTabContext('tab-1', 'staging');

      // Verify context is set
      expect(result.getTabContext('tab-1')).toBe('staging');
    });

    it('interface context updates all tiles without overrides', async () => {
      result = renderContextSelector({
        initialContexts: ['global-ctx'],
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1', 'tile-2'] }],
        initialTiles: [
          { id: 'tile-1', name: 'Tile 1', context: null },
          { id: 'tile-2', name: 'Tile 2', context: null },
        ],
      });

      // Set interface context
      await result.setInterfaceContext('global-ctx');

      // All tiles should inherit the interface context
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('global-ctx');
      expect(result.getEffectiveContext('tile-2', 'tab-1')).toBe('global-ctx');
    });

    it('shows context selector dropdown with available contexts', async () => {
      result = renderContextSelector({
        initialContexts: ['ctx-alpha', 'ctx-beta', 'ctx-gamma'],
      });

      // Open interface context selector
      await result.openContextSelector('interface');

      // Verify dropdown is visible with all contexts
      expect(screen.getByTestId('context-dropdown')).toBeInTheDocument();
      expect(screen.getByTestId('context-option-ctx-alpha')).toBeInTheDocument();
      expect(screen.getByTestId('context-option-ctx-beta')).toBeInTheDocument();
      expect(screen.getByTestId('context-option-ctx-gamma')).toBeInTheDocument();
    });

    it('can select context from dropdown', async () => {
      result = renderContextSelector({
        initialContexts: ['selected-ctx', 'other-ctx'],
      });

      // Open and select
      await result.openContextSelector('interface');
      await result.selectContextFromDropdown('selected-ctx');

      // Verify selection
      expect(result.getInterfaceContext()).toBe('selected-ctx');
      // Dropdown should close
      expect(screen.queryByTestId('context-dropdown')).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // I2: Set Tile Context
  // ==========================================================================
  describe('I2: Set tile context', () => {
    it('can set tile-level context override', async () => {
      result = renderContextSelector({
        initialContexts: ['tile-specific'],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Initially no context
      expect(result.getTileContext('tile-1')).toBeNull();

      // Set tile context
      await result.setTileContext('tile-1', 'tile-specific');

      // Verify context is set
      expect(result.getTileContext('tile-1')).toBe('tile-specific');
    });

    it('tile context overrides tab and interface context', async () => {
      result = renderContextSelector({
        initialContexts: ['interface-ctx', 'tab-ctx', 'tile-ctx'],
        interfaceContext: 'interface-ctx',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: 'tab-ctx', tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Initially tile inherits from tab
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('tab-ctx');

      // Set tile-specific context
      await result.setTileContext('tile-1', 'tile-ctx');

      // Tile context should override
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('tile-ctx');
    });

    it('only affects the specific tile, not others', async () => {
      result = renderContextSelector({
        initialContexts: ['shared-ctx', 'tile1-only'],
        initialTabs: [
          { id: 'tab-1', name: 'Tab 1', context: 'shared-ctx', tileIds: ['tile-1', 'tile-2'] },
        ],
        initialTiles: [
          { id: 'tile-1', name: 'Tile 1', context: null },
          { id: 'tile-2', name: 'Tile 2', context: null },
        ],
      });

      // Set context only on tile-1
      await result.setTileContext('tile-1', 'tile1-only');

      // tile-1 has override, tile-2 inherits from tab
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('tile1-only');
      expect(result.getEffectiveContext('tile-2', 'tab-1')).toBe('shared-ctx');
    });

    it('can open tile context selector via UI', async () => {
      result = renderContextSelector({
        initialContexts: ['ctx-1'],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Open tile context selector
      await result.openContextSelector('tile', 'tile-1');

      // Dropdown should be visible
      expect(screen.getByTestId('context-dropdown')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // I3: Create Context
  // ==========================================================================
  describe('I3: Create context', () => {
    it('can create a new context', async () => {
      result = renderContextSelector({
        initialContexts: ['existing-ctx'],
      });

      // Initially one context
      expect(result.getContexts()).toHaveLength(1);
      expect(result.getContexts()).toContain('existing-ctx');

      // Create new context
      await result.createContext('new-context');

      // Verify new context exists
      expect(result.getContexts()).toHaveLength(2);
      expect(result.getContexts()).toContain('new-context');
    });

    it('new context appears in dropdown', async () => {
      result = renderContextSelector({
        initialContexts: ['initial-ctx'],
      });

      // Create new context
      await result.createContext('fresh-context');

      // Open dropdown
      await result.openContextSelector('interface');

      // New context should be visible
      expect(screen.getByTestId('context-option-fresh-context')).toBeInTheDocument();
    });

    it('does not create duplicate contexts', async () => {
      result = renderContextSelector({
        initialContexts: ['unique-ctx'],
      });

      // Try to create duplicate
      await result.createContext('unique-ctx');

      // Should still have only one
      expect(result.getContexts()).toHaveLength(1);
    });

    it('can create context via UI button', async () => {
      result = renderContextSelector({
        initialContexts: [],
      });

      const user = userEvent.setup();

      // Click create button
      const createButton = screen.getByTestId('create-context-button');
      await user.click(createButton);

      // Should have one context now
      expect(result.getContexts().length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // I4: Context Inheritance
  // ==========================================================================
  describe('I4: Context inheritance', () => {
    it('tile inherits from tab when no tile context set', async () => {
      result = renderContextSelector({
        initialContexts: ['tab-level'],
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: 'tab-level', tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Tile should inherit tab context
      expect(result.getTileContext('tile-1')).toBeNull();
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('tab-level');
    });

    it('tab inherits from interface when no tab context set', async () => {
      result = renderContextSelector({
        initialContexts: ['interface-level'],
        interfaceContext: 'interface-level',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Tab has no context, tile should inherit from interface
      expect(result.getTabContext('tab-1')).toBeNull();
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('interface-level');
    });

    it('full cascade: interface → tab → tile', async () => {
      result = renderContextSelector({
        initialContexts: ['iface-ctx', 'tab-ctx', 'tile-ctx'],
        interfaceContext: 'iface-ctx',
        initialTabs: [
          { id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1', 'tile-2', 'tile-3'] },
          { id: 'tab-2', name: 'Tab 2', context: 'tab-ctx', tileIds: ['tile-4', 'tile-5'] },
        ],
        initialTiles: [
          { id: 'tile-1', name: 'Tile 1', context: null }, // inherits interface
          { id: 'tile-2', name: 'Tile 2', context: null }, // inherits interface
          { id: 'tile-3', name: 'Tile 3', context: 'tile-ctx' }, // has override
          { id: 'tile-4', name: 'Tile 4', context: null }, // inherits tab
          { id: 'tile-5', name: 'Tile 5', context: 'tile-ctx' }, // has override
        ],
      });

      // Tab 1 tiles: inherit from interface (no tab context)
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('iface-ctx');
      expect(result.getEffectiveContext('tile-2', 'tab-1')).toBe('iface-ctx');
      expect(result.getEffectiveContext('tile-3', 'tab-1')).toBe('tile-ctx'); // override

      // Tab 2 tiles: inherit from tab
      expect(result.getEffectiveContext('tile-4', 'tab-2')).toBe('tab-ctx');
      expect(result.getEffectiveContext('tile-5', 'tab-2')).toBe('tile-ctx'); // override
    });

    it('changing interface context updates all inheriting tiles', async () => {
      result = renderContextSelector({
        initialContexts: ['old-iface', 'new-iface'],
        interfaceContext: 'old-iface',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Initially inherits old interface context
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('old-iface');

      // Change interface context
      await result.setInterfaceContext('new-iface');

      // Tile should now inherit new context
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('new-iface');
    });

    it('displays effective context in UI', async () => {
      result = renderContextSelector({
        initialContexts: ['inherited-ctx'],
        interfaceContext: 'inherited-ctx',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: null }],
      });

      // Check effective context is displayed
      const effectiveDisplay = screen.getByTestId('tile-effective-tile-1');
      expect(effectiveDisplay.textContent).toContain('inherited-ctx');
    });
  });

  // ==========================================================================
  // I5: Clear Context
  // ==========================================================================
  describe('I5: Clear context', () => {
    it('can clear interface context', async () => {
      result = renderContextSelector({
        initialContexts: ['to-clear'],
        interfaceContext: 'to-clear',
      });

      // Initially has context
      expect(result.getInterfaceContext()).toBe('to-clear');

      // Clear it
      await result.clearContext('interface', 'test-interface');

      // Should be null
      expect(result.getInterfaceContext()).toBeNull();
    });

    it('can clear tab context', async () => {
      result = renderContextSelector({
        initialContexts: ['tab-ctx'],
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: 'tab-ctx', tileIds: [] }],
      });

      // Initially has context
      expect(result.getTabContext('tab-1')).toBe('tab-ctx');

      // Clear it
      await result.clearContext('tab', 'tab-1');

      // Should be null
      expect(result.getTabContext('tab-1')).toBeNull();
    });

    it('can clear tile context', async () => {
      result = renderContextSelector({
        initialContexts: ['tile-ctx'],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: 'tile-ctx' }],
      });

      // Initially has context
      expect(result.getTileContext('tile-1')).toBe('tile-ctx');

      // Clear it
      await result.clearContext('tile', 'tile-1');

      // Should be null
      expect(result.getTileContext('tile-1')).toBeNull();
    });

    it('clearing tile context falls back to tab/interface context', async () => {
      result = renderContextSelector({
        initialContexts: ['fallback-ctx', 'tile-override'],
        interfaceContext: 'fallback-ctx',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: null, tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: 'tile-override' }],
      });

      // Initially tile has override
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('tile-override');

      // Clear tile context
      await result.clearContext('tile', 'tile-1');

      // Should fall back to interface context
      expect(result.getEffectiveContext('tile-1', 'tab-1')).toBe('fallback-ctx');
    });

    it('can clear context via UI button', async () => {
      result = renderContextSelector({
        initialContexts: ['ui-clear-test'],
        interfaceContext: 'ui-clear-test',
      });

      const user = userEvent.setup();

      // Initially has context
      expect(result.getInterfaceContext()).toBe('ui-clear-test');

      // Click clear button
      const clearButton = screen.getByTestId('interface-context-clear');
      await user.click(clearButton);

      // Should be cleared
      expect(result.getInterfaceContext()).toBeNull();
    });

    it('shows "Select context" when no context is set', async () => {
      result = renderContextSelector({
        initialContexts: ['some-ctx'],
        interfaceContext: null,
      });

      // Button should show placeholder text
      const button = screen.getByTestId('interface-context-button');
      expect(button.textContent).toBe('Select context');
    });
  });

  // ==========================================================================
  // Context Search
  // ==========================================================================
  describe('Context Search', () => {
    it('can filter contexts by search query', async () => {
      result = renderContextSelector({
        initialContexts: ['production', 'staging', 'development', 'prod-backup'],
      });

      // Open dropdown
      await result.openContextSelector('interface');

      // Search for "prod"
      await result.searchContexts('prod');

      // Only matching contexts should be visible
      const visibleContexts = result.getVisibleContexts();
      expect(visibleContexts).toContain('production');
      expect(visibleContexts).toContain('prod-backup');
      expect(visibleContexts).not.toContain('staging');
      expect(visibleContexts).not.toContain('development');
    });

    it('shows "no matches" message when search has no results', async () => {
      result = renderContextSelector({
        initialContexts: ['alpha', 'beta', 'gamma'],
      });

      // Open dropdown
      await result.openContextSelector('interface');

      // Search for non-existent
      await result.searchContexts('xyz123');

      // Should show no matches message
      expect(screen.getByTestId('no-contexts-message')).toBeInTheDocument();
      expect(screen.getByTestId('no-contexts-message').textContent).toContain('No contexts match');
    });

    it('search is case-insensitive', async () => {
      result = renderContextSelector({
        initialContexts: ['Production', 'STAGING', 'development'],
      });

      // Open dropdown
      await result.openContextSelector('interface');

      // Search with different case
      await result.searchContexts('PROD');

      // Should still find Production
      const visibleContexts = result.getVisibleContexts();
      expect(visibleContexts).toContain('Production');
    });
  });

  // ==========================================================================
  // Context Deletion
  // ==========================================================================
  describe('Context Deletion', () => {
    it('can delete a context', async () => {
      result = renderContextSelector({
        initialContexts: ['keep-me', 'delete-me'],
      });

      // Initially two contexts
      expect(result.getContexts()).toHaveLength(2);

      // Delete one
      await result.deleteContext('delete-me');

      // Should have one left
      expect(result.getContexts()).toHaveLength(1);
      expect(result.getContexts()).toContain('keep-me');
      expect(result.getContexts()).not.toContain('delete-me');
    });

    it('deleting context clears it from all using tiles/tabs', async () => {
      result = renderContextSelector({
        initialContexts: ['shared-ctx', 'other-ctx'],
        interfaceContext: 'shared-ctx',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: 'shared-ctx', tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: 'shared-ctx' }],
      });

      // All use shared-ctx
      expect(result.getInterfaceContext()).toBe('shared-ctx');
      expect(result.getTabContext('tab-1')).toBe('shared-ctx');
      expect(result.getTileContext('tile-1')).toBe('shared-ctx');

      // Delete the context
      await result.deleteContext('shared-ctx');

      // All should be cleared
      expect(result.getInterfaceContext()).toBeNull();
      expect(result.getTabContext('tab-1')).toBeNull();
      expect(result.getTileContext('tile-1')).toBeNull();
    });

    it('can delete context via UI', async () => {
      result = renderContextSelector({
        initialContexts: ['ui-delete-test'],
      });

      const user = userEvent.setup();

      // Click delete button
      const deleteButton = screen.getByTestId('delete-context-ui-delete-test');
      await user.click(deleteButton);

      // Context should be gone
      expect(result.getContexts()).not.toContain('ui-delete-test');
    });
  });

  // ==========================================================================
  // Context Renaming
  // ==========================================================================
  describe('Context Renaming', () => {
    it('can rename a context', async () => {
      result = renderContextSelector({
        initialContexts: ['old-name'],
      });

      // Rename
      await result.renameContext('old-name', 'new-name');

      // Should have new name, not old
      expect(result.getContexts()).toContain('new-name');
      expect(result.getContexts()).not.toContain('old-name');
    });

    it('renaming context updates all references', async () => {
      result = renderContextSelector({
        initialContexts: ['rename-me', 'other'],
        interfaceContext: 'rename-me',
        initialTabs: [{ id: 'tab-1', name: 'Tab 1', context: 'rename-me', tileIds: ['tile-1'] }],
        initialTiles: [{ id: 'tile-1', name: 'Tile 1', context: 'rename-me' }],
      });

      // All use rename-me
      expect(result.getInterfaceContext()).toBe('rename-me');
      expect(result.getTabContext('tab-1')).toBe('rename-me');
      expect(result.getTileContext('tile-1')).toBe('rename-me');

      // Rename
      await result.renameContext('rename-me', 'renamed');

      // All should now use new name
      expect(result.getInterfaceContext()).toBe('renamed');
      expect(result.getTabContext('tab-1')).toBe('renamed');
      expect(result.getTileContext('tile-1')).toBe('renamed');
    });
  });
});
