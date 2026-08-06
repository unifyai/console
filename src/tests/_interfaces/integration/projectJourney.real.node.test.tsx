/**
 * Real API tests for complete project journey.
 *
 * These tests verify the full CRUD lifecycle across multiple resources:
 * Project -> Interface -> Tab -> Tile
 *
 * This tests what useCreateProjectQuery does but with real API calls.
 */

import React from 'react';
import { describe, it, expect, afterAll } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  projectsApi,
  interfacesApi,
  tabsApi,
  tilesApi,
  uniqueName,
  safeDelete,
  realTestOptionsExtended,
} from '@/tests/_interfaces/api/fixtures/api-actions';

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { Wrapper, client };
};

describe('@real Complete Project Journey (Real API)', () => {
  const createdResources: {
    projectName?: string;
    interfaceId?: string;
    tabId?: string;
    tileId?: string;
  } = {};

  afterAll(async () => {
    // Cleanup in reverse order
    if (createdResources.tileId) {
      await safeDelete(
        () => tilesApi.deleteById(createdResources.tileId!),
        `tile: ${createdResources.tileId}`
      );
    }
    if (createdResources.tabId) {
      await safeDelete(
        () => tabsApi.deleteById(createdResources.tabId!),
        `tab: ${createdResources.tabId}`
      );
    }
    if (createdResources.interfaceId) {
      await safeDelete(
        () => interfacesApi.deleteById(createdResources.interfaceId!),
        `interface: ${createdResources.interfaceId}`
      );
    }
    if (createdResources.projectName) {
      await safeDelete(
        () => projectsApi.delete(createdResources.projectName!),
        `project: ${createdResources.projectName}`
      );
    }
  }, 30000);

  it(
    '@real creates complete project stack: Project -> Interface -> Tab -> Tile',
    realTestOptionsExtended,
    async () => {
      // Step 1: Create Project
      const projectName = uniqueName('journey-test');
      const projectResult = await projectsApi.create(projectName);
      expect(projectResult.info).toContain('created');
      createdResources.projectName = projectName;

      // Step 2: Create Interface in project
      const interfaceName = uniqueName('journey-interface');
      const interfaceResult = await interfacesApi.create(projectName, interfaceName);
      expect(interfaceResult).toBeDefined();
      expect(interfaceResult.id).toBeDefined();
      expect(interfaceResult.name).toBe(interfaceName);
      createdResources.interfaceId = interfaceResult.id;

      // Step 3: Create Tab in interface
      const tabName = uniqueName('journey-tab');
      const tabResult = await tabsApi.create(interfaceResult.id, tabName, {
        order: 0,
        context: null,
      } as any);
      expect(tabResult).toBeDefined();
      expect(tabResult.id).toBeDefined();
      expect(tabResult.name).toBe(tabName);
      createdResources.tabId = tabResult.id;

      // Step 4: Create Tile in tab
      const tileName = uniqueName('journey-tile');
      const tileResult = await tilesApi.create(
        tabResult.id,
        tileName,
        { x: 0, y: 0, width: 6, height: 4 },
        { type: 'Table' }
      );
      expect(tileResult).toBeDefined();
      expect(tileResult.id).toBeDefined();
      expect(tileResult.name).toBe(tileName);
      expect(tileResult.type).toBe('Table');
      createdResources.tileId = tileResult.id;

      // Verify the chain exists by fetching each resource
      const fetchedInterface = await interfacesApi.getById(interfaceResult.id);
      expect(fetchedInterface).toBeDefined();
      expect(fetchedInterface.name).toBe(interfaceName);

      const fetchedTab = await tabsApi.getById(tabResult.id);
      expect(fetchedTab).toBeDefined();
      expect(fetchedTab.name).toBe(tabName);

      const fetchedTile = await tilesApi.getById(tileResult.id);
      expect(fetchedTile).toBeDefined();
      expect(fetchedTile.name).toBe(tileName);
    }
  );

  it('@real updates resources in the resource chain', realTestOptionsExtended, async () => {
    // Requires resources from previous test
    if (!createdResources.projectName || !createdResources.interfaceId) {
      // Create fresh resources if not available
      const projectName = uniqueName('journey-update');
      await projectsApi.create(projectName);
      createdResources.projectName = projectName;

      const interfaceResult = await interfacesApi.create(
        projectName,
        uniqueName('update-interface')
      );
      createdResources.interfaceId = interfaceResult.id;

      const tabResult = await tabsApi.create(interfaceResult.id, uniqueName('update-tab'), {
        order: 0,
      } as any);
      createdResources.tabId = tabResult.id;

      const tileResult = await tilesApi.create(
        tabResult.id,
        uniqueName('update-tile'),
        { x: 0, y: 0, width: 6, height: 4 },
        { type: 'Table' }
      );
      createdResources.tileId = tileResult.id;
    }

    // Update Interface
    const updatedInterface = await interfacesApi.updateById(createdResources.interfaceId!, {
      color: '#ff0000',
    });
    expect(updatedInterface.color).toBe('#ff0000');

    // Update Tab
    if (createdResources.tabId) {
      const updatedTab = await tabsApi.updateById(createdResources.tabId, {
        color: '#00ff00',
      });
      expect(updatedTab.color).toBe('#00ff00');
    }

    // Update Tile
    if (createdResources.tileId) {
      const updatedTile = await tilesApi.updateById(createdResources.tileId, {
        color: '#0000ff',
      } as any);
      expect((updatedTile as any).color).toBe('#0000ff');
    }
  });

  it('@real deletes resources in the resource chain', realTestOptionsExtended, async () => {
    // Create fresh resources for deletion test
    const projectName = uniqueName('journey-delete');
    await projectsApi.create(projectName);

    const interfaceResult = await interfacesApi.create(projectName, uniqueName('delete-interface'));
    const tabResult = await tabsApi.create(interfaceResult.id, uniqueName('delete-tab'), {
      order: 0,
    } as any);
    const tileResult = await tilesApi.create(
      tabResult.id,
      uniqueName('delete-tile'),
      { x: 0, y: 0, width: 6, height: 4 },
      { type: 'Table' }
    );

    // Delete in order: Tile -> Tab -> Interface -> Project
    const tileDeleteResult = await tilesApi.deleteById(tileResult.id);
    expect(tileDeleteResult).toBeDefined();

    const tabDeleteResult = await tabsApi.deleteById(tabResult.id);
    expect(tabDeleteResult).toBeDefined();

    const interfaceDeleteResult = await interfacesApi.deleteById(interfaceResult.id);
    expect(interfaceDeleteResult).toBeDefined();

    const projectDeleteResult = await projectsApi.delete(projectName);
    expect((projectDeleteResult as any).info).toContain('deleted');
  });
});
