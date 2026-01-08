import { InterfaceData } from '@/types/interfaces/grid';
import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  TabData,
} from '@/types/interfaces/grid';
import { defaultInterface, defaultTab, defaultTiles } from '@/constants/logs';
import { QueryClient } from '@tanstack/react-query';
import { dedupedJson } from '@/lib/requestDeduper';

// Extended interface data with additional fields for the table
export interface ExtendedInterfaceData extends InterfaceData {
  tags: string[];
}

/**
 * Transform interfaces data with additional fields needed for the table
 * @param interfaces - Raw interface data from API
 * @returns Extended interface data with computed fields
 */
export function transformInterfacesData(interfaces: InterfaceData[]): ExtendedInterfaceData[] {
  return interfaces.map((iface) => {
    return {
      ...iface,
      tags: ['Default', 'Production'], // Placeholder tags - replace with actual logic
    };
  });
}

/**
 * Filter interfaces based on search query
 * @param interfaces - Extended interface data
 * @param searchQuery - Search string
 * @returns Filtered interfaces
 */
export function filterInterfaces(
  interfaces: ExtendedInterfaceData[],
  searchQuery: string
): ExtendedInterfaceData[] {
  if (!searchQuery.trim()) return interfaces;

  const query = searchQuery.toLowerCase();
  return interfaces.filter(
    (iface) =>
      iface.id?.toLowerCase().includes(query) ||
      iface.name.toLowerCase().includes(query) ||
      iface.tags.some((tag) => tag.toLowerCase().includes(query))
  );
}

/**
 * Create URL for interface navigation
 * @param searchParams - Current URL search parameters
 * @param interfaceName - Name of the interface to navigate to
 * @returns New URL string
 */
export function createInterfaceUrl(searchParams: URLSearchParams, interfaceName: string): string {
  const currentParams = new URLSearchParams(searchParams.toString());
  currentParams.set('interface', interfaceName);
  return `/interfaces?${currentParams.toString()}`;
}

/**
 * Generate placeholder tags for an interface (replace with actual logic)
 * @param interfaceData - Interface data
 * @returns Array of tag strings
 */
export function generateInterfaceTags(interfaceData: InterfaceData): string[] {
  // TODO: Replace with actual tag logic based on interface properties
  const tags: string[] = [];

  // Example logic based on interface properties
  if (interfaceData.createdAt) {
    const createdDate = new Date(interfaceData.createdAt);
    const isRecent = Date.now() - createdDate.getTime() < 7 * 24 * 60 * 60 * 1000; // 7 days
    if (isRecent) tags.push('Recent');
  }

  // Add default tags
  tags.push('Production', 'Analysis');

  return tags;
}

/**
 * Find a unique interface name by appending numbers if needed
 * @param baseName - Base name to start with
 * @param existingInterfaces - Array of existing interfaces
 * @returns A unique interface name
 */
export function findUniqueInterfaceName(
  baseName: string,
  existingInterfaces: InterfaceData[]
): string {
  const existingNames = existingInterfaces.map((iface) => iface.name.toLowerCase());

  // If the base name is not taken, use it
  if (!existingNames.includes(baseName.toLowerCase())) {
    return baseName;
  }

  // Find the next available number
  let counter = 1;
  let candidateName = `${baseName}${counter}`;

  while (existingNames.includes(candidateName.toLowerCase())) {
    counter++;
    candidateName = `${baseName}${counter}`;
  }

  return candidateName;
}

/**
 * Utility helper for updating query cache
 */
const upsert = <T>(arr: T[] | undefined, item: T): T[] => {
  if (!arr) return [item];
  const idx = arr.findIndex((i) => (i as any).id === (item as any).id);
  if (idx === -1) return [...arr, item];
  const clone = [...arr];
  clone[idx] = item;
  return clone;
};

/**
 * Ensure the target interface is loadable by preflighting the API route.
 * Throws on non-OK responses (including upstream timeouts surfaced by the proxy).
 */
export async function ensureInterfaceLoadable(
  project: string,
  name: string,
  signal?: AbortSignal
): Promise<void> {
  const qs = new URLSearchParams({ projectName: project, name, checkpoint: 'false' });
  const { ok, status, json } = await dedupedJson(`/api/interface?${qs.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  });
  if (!ok) {
    const detail = json?.detail || `Interfaces ${status}`;
    const err = new Error(detail);
    (err as any).status = status;
    throw err;
  }
}

/**
 * Create default tiles for a tab
 * @param tabId - ID of the tab to create tiles for
 * @param tileActions - Tile actions instance
 */
async function createDefaultTiles(tabId: string, tileActions: GranularTileActions): Promise<void> {
  try {
    for (const tile of defaultTiles) {
      const { name, type, position, ...tileProps } = tile;

      // Handle specialized tile data
      const specializedData: {
        tableTile?: typeof tile.tableTile;
        plotTile?: typeof tile.plotTile;
        viewTile?: typeof tile.viewTile;
        editorTile?: typeof tile.editorTile;
        terminalTile?: typeof tile.terminalTile;
      } = {};

      if (tile.tableTile) specializedData.tableTile = tile.tableTile;
      if (tile.plotTile) specializedData.plotTile = tile.plotTile;
      if (tile.viewTile) specializedData.viewTile = tile.viewTile;
      if (tile.editorTile) specializedData.editorTile = tile.editorTile;
      if (tile.terminalTile) specializedData.terminalTile = tile.terminalTile;

      // Remove specialized data and server-generated props from tileProps to avoid duplication
      const {
        tableTile,
        plotTile,
        viewTile,
        editorTile,
        terminalTile,
        id,
        tabId: _tabId,
        createdAt,
        updatedAt,
        ...restTileProps
      } = tileProps;

      // Prepare tile data with all available properties
      const tileData = {
        ...restTileProps,
        ...specializedData,
      };

      await tileActions.create(
        tabId, // Use the function parameter, not the destructured one
        name,
        position,
        tileData,
        undefined, // tileId
        type
      );
    }
  } catch (error) {
    console.error('[createDefaultTiles] Failed to create default tiles:', error);
    throw error;
  }
}

/**
 * Create a complete default interface with tab and tiles
 * @param project - Project ID
 * @param interfaceActions - Interface actions instance
 * @param tabActions - Tab actions instance
 * @param tileActions - Tile actions instance
 * @param baseName - Optional base name for the interface (defaults to defaultInterface.name)
 * @returns The created interface data
 */
export async function createCompleteDefaultInterface({
  queryClient,
  project,
  interfaceActions,
  tabActions,
  tileActions,
  baseName,
}: {
  queryClient: QueryClient;
  project: string;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  baseName?: string;
}): Promise<InterfaceData | null> {
  try {
    // Fetch the latest list of interfaces to ensure the name is unique
    const existingInterfaces = await interfaceActions.list(project, false);
    if (!Array.isArray(existingInterfaces)) {
      throw new Error('Failed to retrieve existing interfaces for uniqueness check.');
    }

    // Find a unique name for the interface
    const interfaceName = findUniqueInterfaceName(
      baseName || defaultInterface.name,
      existingInterfaces
    );

    // Create the interface
    const newInterface = await interfaceActions.create(project, interfaceName);

    if (!newInterface || !newInterface.id) {
      throw new Error('Failed to create interface');
    }

    // Cache the new interface immediately
    queryClient.setQueryData<InterfaceData[]>(
      ['interfaces', project, false],
      (old) => upsert(old, newInterface) as InterfaceData[]
    );

    // Create the default tab
    const { name: tabName, ...tabProps } = defaultTab;
    const newTab = await tabActions.create(newInterface.id, tabName, tabProps);

    if (!newTab || !newTab.id) {
      throw new Error('Failed to create default tab');
    }

    // Keep cache in sync
    queryClient.setQueryData<TabData[]>(
      ['tabs', newInterface.id],
      (old) => upsert(old, newTab) as TabData[]
    );

    // Create default tiles for the new tab
    await createDefaultTiles(newTab.id, tileActions);

    // Update interface with active tab id
    await interfaceActions.update({
      interfaceId: newInterface.id,
      data: { activeTabId: newTab.id },
    });

    // Update cache with active tab id
    const updatedInterface = {
      ...newInterface,
      activeTabId: newTab.id,
    };

    queryClient.setQueryData<InterfaceData[]>(
      ['interfaces', project, false],
      (old) => upsert(old, updatedInterface) as InterfaceData[]
    );

    return updatedInterface;
  } catch (error) {
    console.error('[createCompleteDefaultInterface] Failed to create interface:', error);
    throw error;
  }
}
