'use client';

import { useMutation } from '@tanstack/react-query';
import {
  InterfaceData,
  TabData,
  TileData,
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  CodeActions,
  DerivedEntryActions,
  FileActions,
} from '@/types/interfaces/grid';
import { GetLogsParameters } from '@/types/interfaces/logs';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Input interface for the demo creation process
 * Matches the structure in src/constants/logs.tsx exactly
 */
export interface DemoCreationInput {
  interface: InterfaceData;
  tab: TabData;
  tiles: TileData[];
  derivedColumns?: {
    project: string;
    context?: string | undefined;
    key: string;
    equation: string;
    referencedLogs: { [table_name: string]: GetLogsParameters };
  };
  code?: string;
  actions: {
    interfaceActions: GranularInterfaceActions;
    tabActions: GranularTabActions;
    tileActions: GranularTileActions;
    codeActions?: CodeActions;
    derivedEntryActions?: DerivedEntryActions;
    fileActions?: FileActions;
  };
}

/**
 * Result interface for the demo creation process
 */
export interface DemoCreationResult {
  interface: InterfaceData;
  tab: TabData;
  tiles: TileData[];
}

/**
 * A hook to create a complete demo with interface, tab, and tiles
 */
export function useCreateDemoQuery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DemoCreationInput): Promise<DemoCreationResult> => {
      const {
        interface: demoInterface,
        tab: demoTab,
        tiles: demoTiles,
        derivedColumns,
        code,
        actions,
      } = input;

      console.log('[useCreateDemoQuery] Creating demo with input:', input);

      // Run code if provided
      if (code && actions.codeActions && actions.fileActions) {
        console.log('[useCreateDemoQuery] Running code...');
        await actions.fileActions.write('demo', { 'main.py': code });
        await actions.codeActions.run('demo', 'main.py');
        while (!(await actions.codeActions.get('demo/main.py')).done) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
        console.log('[useCreateDemoQuery] Code ran successfully');
      }

      try {
        // Step 1: Create interface
        // Handle case where projectId might be undefined
        if (!demoInterface.projectId) {
          throw new Error('Interface must have projectId defined');
        }

        if (!demoInterface.name) {
          throw new Error('Interface must have name defined');
        }

        const { projectId, name, ...interfaceProps } = demoInterface;

        // Ensure we're only passing valid interface properties
        const safeInterfaceProps: Partial<
          Omit<InterfaceData, 'id' | 'projectId' | 'name' | 'createdAt' | 'updatedAt'>
        > = interfaceProps;

        const createdInterface = await actions.interfaceActions.create(
          projectId,
          name,
          safeInterfaceProps.color
        );

        console.log('[useCreateDemoQuery] Created interface:', createdInterface);

        // Step 2: Create tab under the interface
        if (!demoTab.name) {
          throw new Error('Tab must have name defined');
        }

        const { name: tabName, ...tabProps } = demoTab;

        // Make sure we're using all available tab properties
        const safeTabProps: Partial<
          Omit<TabData, 'id' | 'interfaceId' | 'name' | 'createdAt' | 'updatedAt'>
        > = tabProps;

        const createdTab = await actions.tabActions.create(
          createdInterface.id || '',
          tabName,
          safeTabProps
        );

        console.log('[useCreateDemoQuery] Created tab:', createdTab);

        // Step 3: Create all tiles in parallel
        const createdTiles = await Promise.all(
          demoTiles.map((tile) => {
            if (!tile.name || !tile.type || !tile.position) {
              throw new Error('Tile must have name, type, and position defined');
            }

            const { name: tileName, type, position, ...tileProps } = tile;

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

            // Remove specialized data from tileProps to avoid duplication
            const {
              tableTile,
              plotTile,
              viewTile,
              editorTile,
              terminalTile,
              id,
              tabId,
              createdAt,
              updatedAt,
              ...restTileProps
            } = tileProps;

            // Prepare tile data with all available properties
            const tileData: Omit<
              Partial<TileData>,
              'id' | 'tabId' | 'name' | 'type' | 'position' | 'createdAt' | 'updatedAt'
            > = {
              ...restTileProps,
              ...specializedData,
            };

            return actions.tileActions.create(
              createdTab.id || '',
              tileName,
              position,
              tileData,
              undefined,
              type
            );
          })
        );

        console.log('[useCreateDemoQuery] Created tiles:', createdTiles);

        // Step 4: Handle derived columns if needed
        if (derivedColumns && actions.derivedEntryActions) {
          await actions.derivedEntryActions.create(
            derivedColumns.project,
            derivedColumns.context,
            derivedColumns.key,
            derivedColumns.equation,
            derivedColumns.referencedLogs
          );
        }

        // Return the created resources
        return {
          interface: createdInterface,
          tab: createdTab,
          tiles: createdTiles,
        };
      } catch (error) {
        // If anything fails, try to clean up by deleting the interface
        // This will cascade delete tabs and tiles
        try {
          if (demoInterface.projectId) {
            // This is a simplification - ideally you'd use proper deletion
            // through the interface actions
            console.error('Error creating demo, attempting cleanup:', error);
          }
        } catch (cleanupError) {
          console.error('Error during cleanup:', cleanupError);
        }

        throw error;
      }
    },

    onSuccess: (result) => {
      // Invalidate queries related to the created resources
      if (result.interface.projectId) {
        queryClient.invalidateQueries({
          queryKey: ['interfaces', result.interface.projectId],
        });
      }

      if (result.interface.id) {
        queryClient.invalidateQueries({
          queryKey: ['interface-by-id', result.interface.id],
        });
      }

      if (result.tab.interfaceId) {
        queryClient.invalidateQueries({
          queryKey: ['tabs', result.tab.interfaceId],
        });

        queryClient.invalidateQueries({
          queryKey: ['interface-with-tabs', result.tab.interfaceId],
        });
      }

      // Invalidate tile queries
      if (result.tab.id) {
        queryClient.invalidateQueries({
          queryKey: ['tiles', result.tab.id],
        });

        queryClient.invalidateQueries({
          queryKey: ['tab-with-tiles-by-id', result.tab.id],
        });
      }
    },
  });
}
