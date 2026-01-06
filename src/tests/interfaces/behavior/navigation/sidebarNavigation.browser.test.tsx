/**
 * P4: Sidebar Navigation Behavior Tests
 *
 * Tests behaviors N1-N7 from BEHAVIORS.md:
 * - N1: Collapse sidebar
 * - N2: Expand sidebar
 * - N3: Resize sidebar
 * - N4: Hide sidebar completely
 * - N5: Add to favorites
 * - N6: Remove from favorites
 * - N7: Favorites section
 */

import { describe, it, expect, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import {
  renderSidebarNavigation,
  SidebarNavigationTestResult,
  Favourite,
} from '../fixtures/sidebarNavigationTestHarness';

describe('P4-N: Sidebar Navigation', () => {
  let result: SidebarNavigationTestResult;

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // N1: Collapse Sidebar
  // ==========================================================================
  describe('N1: Collapse sidebar', () => {
    it('can collapse sidebar via button', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: false,
      });

      expect(result.isCollapsed()).toBe(false);

      await result.clickCollapseButton();

      await waitFor(() => {
        expect(result.isCollapsed()).toBe(true);
      });
    });

    it('collapsed sidebar has reduced width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
        initialCollapsed: false,
      });

      expect(result.getWidth()).toBe(256);

      await result.collapse();

      expect(result.getWidth()).toBe(48); // Collapsed width
    });

    it('collapse button is visible when expanded', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: false,
      });

      expect(screen.getByTestId('sidebar-collapse-button')).toBeInTheDocument();
    });

    it('programmatic collapse works', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: false,
      });

      await result.collapse();

      expect(result.isCollapsed()).toBe(true);
    });

    it('shows collapsed state indicator', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: true,
      });

      expect(screen.getByTestId('sidebar-state-display').textContent).toBe('collapsed');
    });
  });

  // ==========================================================================
  // N2: Expand Sidebar
  // ==========================================================================
  describe('N2: Expand sidebar', () => {
    it('can expand sidebar via button', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: true,
      });

      expect(result.isCollapsed()).toBe(true);

      await result.clickExpandButton();

      await waitFor(() => {
        expect(result.isCollapsed()).toBe(false);
      });
    });

    it('expanded sidebar has full width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 300,
        initialCollapsed: true,
      });

      expect(result.getWidth()).toBe(48); // Collapsed

      await result.expand();

      expect(result.getWidth()).toBe(300); // Back to original
    });

    it('expand button is visible when collapsed', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: true,
      });

      expect(screen.getByTestId('sidebar-expand-button')).toBeInTheDocument();
    });

    it('programmatic expand works', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: true,
      });

      await result.expand();

      expect(result.isCollapsed()).toBe(false);
    });

    it('shows expanded state indicator', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: false,
      });

      expect(screen.getByTestId('sidebar-state-display').textContent).toBe('expanded');
    });
  });

  // ==========================================================================
  // N3: Resize Sidebar
  // ==========================================================================
  describe('N3: Resize sidebar', () => {
    it('can resize sidebar to specific width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
      });

      await result.resize(320);

      expect(result.getWidth()).toBe(320);
    });

    it('respects minimum width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
      });

      await result.resize(100); // Below minimum

      expect(result.getWidth()).toBe(192); // Clamped to min
    });

    it('respects maximum width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
      });

      await result.resize(600); // Above maximum

      expect(result.getWidth()).toBe(480); // Clamped to max
    });

    it('resize expands collapsed sidebar', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
        initialCollapsed: true,
      });

      expect(result.isCollapsed()).toBe(true);

      await result.resize(300);

      expect(result.isCollapsed()).toBe(false);
      expect(result.getWidth()).toBe(300);
    });

    it('displays current width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
      });

      expect(screen.getByTestId('sidebar-width-display').textContent).toContain('256');
    });
  });

  // ==========================================================================
  // N4: Hide Sidebar Completely
  // ==========================================================================
  describe('N4: Hide sidebar completely', () => {
    it('can hide sidebar completely', async () => {
      result = renderSidebarNavigation({
        initialHidden: false,
      });

      expect(result.isHidden()).toBe(false);

      await result.hide();

      expect(result.isHidden()).toBe(true);
    });

    it('hidden sidebar has zero width', async () => {
      result = renderSidebarNavigation({
        initialWidth: 256,
      });

      await result.hide();

      expect(result.getWidth()).toBe(0);
    });

    it('shows expand button when hidden', async () => {
      result = renderSidebarNavigation({
        initialHidden: true,
      });

      expect(screen.getByTestId('sidebar-expand-hidden')).toBeInTheDocument();
    });

    it('can restore from hidden state', async () => {
      result = renderSidebarNavigation({
        initialHidden: true,
      });

      expect(result.isHidden()).toBe(true);

      await result.show();

      expect(result.isHidden()).toBe(false);
    });

    it('shows hidden state indicator', async () => {
      result = renderSidebarNavigation({
        initialHidden: true,
      });

      expect(screen.getByTestId('sidebar-state-display').textContent).toBe('hidden');
    });

    it('clicking expand from hidden shows sidebar', async () => {
      result = renderSidebarNavigation({
        initialHidden: true,
      });

      await result.clickExpandButton();

      await waitFor(() => {
        expect(result.isHidden()).toBe(false);
      });
    });
  });

  // ==========================================================================
  // N5: Add to Favorites
  // ==========================================================================
  describe('N5: Add to favorites', () => {
    it('can add interface to favorites', async () => {
      result = renderSidebarNavigation({
        interfaces: [
          { id: 'iface-1', name: 'My Interface', projectId: 'proj-1' },
        ],
        initialFavorites: [],
      });

      expect(result.getFavorites()).toHaveLength(0);

      await result.addFavorite({ id: 'iface-1', name: 'My Interface', type: 'interface' });

      expect(result.getFavorites()).toHaveLength(1);
      expect(result.isFavorite('iface-1')).toBe(true);
    });

    it('can add favorite via UI button', async () => {
      result = renderSidebarNavigation({
        interfaces: [
          { id: 'iface-1', name: 'Favoritable', projectId: 'proj-1' },
        ],
        initialFavorites: [],
      });

      await result.clickFavoriteButton('iface-1');

      await waitFor(() => {
        expect(result.isFavorite('iface-1')).toBe(true);
      });
    });

    it('favorite button shows filled star after adding', async () => {
      result = renderSidebarNavigation({
        interfaces: [
          { id: 'iface-1', name: 'Test', projectId: 'proj-1' },
        ],
        initialFavorites: [],
      });

      // Initially empty star
      const button = screen.getByTestId('favorite-button-iface-1');
      expect(button.textContent).toBe('☆');

      await result.clickFavoriteButton('iface-1');

      // Now filled star
      await waitFor(() => {
        expect(button.textContent).toBe('★');
      });
    });

    it('does not add duplicate favorites', async () => {
      result = renderSidebarNavigation({
        initialFavorites: [
          { id: 'iface-1', name: 'Already Fav', type: 'interface' },
        ],
      });

      expect(result.getFavorites()).toHaveLength(1);

      await result.addFavorite({ id: 'iface-1', name: 'Already Fav', type: 'interface' });

      expect(result.getFavorites()).toHaveLength(1);
    });
  });

  // ==========================================================================
  // N6: Remove from Favorites
  // ==========================================================================
  describe('N6: Remove from favorites', () => {
    it('can remove interface from favorites', async () => {
      result = renderSidebarNavigation({
        initialFavorites: [
          { id: 'iface-1', name: 'To Remove', type: 'interface' },
        ],
      });

      expect(result.isFavorite('iface-1')).toBe(true);

      await result.removeFavorite('iface-1');

      expect(result.isFavorite('iface-1')).toBe(false);
    });

    it('can remove favorite via UI button toggle', async () => {
      result = renderSidebarNavigation({
        interfaces: [
          { id: 'iface-1', name: 'Favorited', projectId: 'proj-1' },
        ],
        initialFavorites: [
          { id: 'iface-1', name: 'Favorited', type: 'interface' },
        ],
      });

      expect(result.isFavorite('iface-1')).toBe(true);

      // Click to toggle off
      await result.clickFavoriteButton('iface-1');

      await waitFor(() => {
        expect(result.isFavorite('iface-1')).toBe(false);
      });
    });

    it('removed favorite disappears from favorites section', async () => {
      result = renderSidebarNavigation({
        interfaces: [
          { id: 'iface-1', name: 'Removed', projectId: 'proj-1' },
        ],
        initialFavorites: [
          { id: 'iface-1', name: 'Removed', type: 'interface' },
        ],
      });

      expect(result.getVisibleFavorites()).toContain('Removed');

      await result.removeFavorite('iface-1');

      await waitFor(() => {
        expect(result.getVisibleFavorites()).not.toContain('Removed');
      });
    });
  });

  // ==========================================================================
  // N7: Favorites Section
  // ==========================================================================
  describe('N7: Favorites section', () => {
    it('favorites section is visible when favorites exist', async () => {
      result = renderSidebarNavigation({
        initialFavorites: [
          { id: 'iface-1', name: 'Fav 1', type: 'interface' },
        ],
      });

      expect(screen.getByTestId('favorites-section')).toBeInTheDocument();
    });

    it('favorites section is hidden when no favorites', async () => {
      result = renderSidebarNavigation({
        initialFavorites: [],
      });

      expect(screen.queryByTestId('favorites-section')).not.toBeInTheDocument();
    });

    it('favorites are shown at top of sidebar', async () => {
      result = renderSidebarNavigation({
        initialFavorites: [
          { id: 'iface-1', name: 'Top Fav', type: 'interface' },
        ],
      });

      const sidebar = screen.getByTestId('sidebar');
      const favSection = screen.getByTestId('favorites-section');
      const ifaceSection = screen.getByTestId('interfaces-section');

      // Favorites should come before interfaces in DOM order
      const children = Array.from(sidebar.querySelectorAll('[data-testid]'));
      const favIndex = children.findIndex(el => el.getAttribute('data-testid') === 'favorites-section');
      const ifaceIndex = children.findIndex(el => el.getAttribute('data-testid') === 'interfaces-section');

      expect(favIndex).toBeLessThan(ifaceIndex);
    });

    it('multiple favorites are displayed', async () => {
      result = renderSidebarNavigation({
        initialFavorites: [
          { id: 'iface-1', name: 'Fav One', type: 'interface' },
          { id: 'iface-2', name: 'Fav Two', type: 'interface' },
          { id: 'iface-3', name: 'Fav Three', type: 'interface' },
        ],
      });

      const visibleFavs = result.getVisibleFavorites();
      expect(visibleFavs).toContain('Fav One');
      expect(visibleFavs).toContain('Fav Two');
      expect(visibleFavs).toContain('Fav Three');
    });

    it('favorites section hidden when sidebar collapsed', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: true,
        initialFavorites: [
          { id: 'iface-1', name: 'Hidden Fav', type: 'interface' },
        ],
      });

      // Favorites section should not be visible in collapsed state
      expect(screen.queryByTestId('favorites-section')).not.toBeInTheDocument();
    });

    it('favorites section appears when sidebar expanded', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: true,
        initialFavorites: [
          { id: 'iface-1', name: 'Shown Fav', type: 'interface' },
        ],
      });

      expect(screen.queryByTestId('favorites-section')).not.toBeInTheDocument();

      await result.expand();

      await waitFor(() => {
        expect(screen.getByTestId('favorites-section')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles rapid collapse/expand', async () => {
      result = renderSidebarNavigation({
        initialCollapsed: false,
      });

      await result.collapse();
      await result.expand();
      await result.collapse();
      await result.expand();

      expect(result.isCollapsed()).toBe(false);
    });

    it('handles many favorites', async () => {
      const manyFavorites: Favourite[] = Array.from({ length: 10 }, (_, i) => ({
        id: `iface-${i}`,
        name: `Favorite ${i}`,
        type: 'interface',
      }));

      result = renderSidebarNavigation({
        initialFavorites: manyFavorites,
      });

      expect(result.getFavorites()).toHaveLength(10);
    });
  });
});

