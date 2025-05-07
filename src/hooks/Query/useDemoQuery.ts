"use client";

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  InterfaceData, 
  TabData, 
  TileData, 
  GranularInterfaceActions, 
  GranularTabActions, 
  GranularTileActions,
  CodeActions,
  DerivedEntryActions
} from '@/types/evals/grid';
import { getLogsParameters } from '@/types/evals/logs';

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
    referenced_logs: { [table_name: string]: getLogsParameters };
  };
  code?: string;
  actions: {
    interfaceActions: GranularInterfaceActions;
    tabActions: GranularTabActions;
    tileActions: GranularTileActions;
    codeActions?: CodeActions;
    derivedEntryActions?: DerivedEntryActions;
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
        actions
      } = input;
      
      // Run code if provided
      if (code && actions.codeActions) {
        await actions.codeActions.run({ "main.py": code }, "main.py", "");
      }
      
      try {
        // Step 1: Create interface
        // Handle case where project_id might be undefined
        if (!demoInterface.project_id) {
          throw new Error("Interface must have project_id defined");
        }
        
        if (!demoInterface.name) {
          throw new Error("Interface must have name defined");
        }
        
        const { project_id, name, ...interfaceProps } = demoInterface;
        
        // Ensure we're only passing valid interface properties
        const safeInterfaceProps: Partial<Omit<InterfaceData, 'id' | 'project_id' | 'name' | 'created_at' | 'updated_at'>> = 
          interfaceProps;
        
        const createdInterface = await actions.interfaceActions.create(
          project_id, 
          name, 
          safeInterfaceProps.color
        );
        
        // Step 2: Create tab under the interface
        if (!demoTab.name) {
          throw new Error("Tab must have name defined");
        }
        
        const { name: tabName, ...tabProps } = demoTab;
        
        // Make sure we're using all available tab properties
        const safeTabProps: Partial<Omit<TabData, 'id' | 'interface_id' | 'name' | 'created_at' | 'updated_at'>> = 
          tabProps;
        
        const createdTab = await actions.tabActions.create(
          createdInterface.id || "", 
          tabName, 
          safeTabProps
        );
        
        // Step 3: Create all tiles in parallel
        const createdTiles = await Promise.all(
          demoTiles.map(tile => {
            if (!tile.name || !tile.type || !tile.position) {
              throw new Error("Tile must have name, type, and position defined");
            }
            
            const { name: tileName, type, position, ...tileProps } = tile;
            
            // Handle specialized tile data
            const specializedData: {
              table_tile?: typeof tile.table_tile;
              plot_tile?: typeof tile.plot_tile;
              view_tile?: typeof tile.view_tile;
              editor_tile?: typeof tile.editor_tile;
            } = {};
            
            if (tile.table_tile) specializedData.table_tile = tile.table_tile;
            if (tile.plot_tile) specializedData.plot_tile = tile.plot_tile;
            if (tile.view_tile) specializedData.view_tile = tile.view_tile;
            if (tile.editor_tile) specializedData.editor_tile = tile.editor_tile;
            
            // Remove specialized data from tileProps to avoid duplication
            const { 
              table_tile, plot_tile, view_tile, editor_tile, 
              id, tab_id, created_at, updated_at, ...restTileProps 
            } = tileProps;
            
            // Prepare tile data with all available properties
            const tileData: Omit<Partial<TileData>, 'id' | 'tab_id' | 'name' | 'type' | 'position' | 'created_at' | 'updated_at'> = {
              min_width: position.width,
              min_height: position.height,
              ...restTileProps,
              ...specializedData
            };
            
            return actions.tileActions.create(
              createdTab.id || "", 
              tileName, 
              type, 
              position, 
              tileData
            );
          })
        );
        
        // Step 4: Handle derived columns if needed
        if (derivedColumns && actions.derivedEntryActions) {
          await actions.derivedEntryActions.create(
            derivedColumns.project,
            derivedColumns.context,
            derivedColumns.key,
            derivedColumns.equation,
            derivedColumns.referenced_logs
          );
        }
        
        // Return the created resources
        return {
          interface: createdInterface,
          tab: createdTab,
          tiles: createdTiles
        };
      } catch (error) {
        // If anything fails, try to clean up by deleting the interface
        // This will cascade delete tabs and tiles
        try {
          if (demoInterface.project_id) {
            // This is a simplification - ideally you'd use proper deletion
            // through the interface actions
            console.error("Error creating demo, attempting cleanup:", error);
          }
        } catch (cleanupError) {
          console.error("Error during cleanup:", cleanupError);
        }
        
        throw error;
      }
    },
    
    onSuccess: (result) => {
      // Invalidate queries related to the created resources
      if (result.interface.project_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['interfaces', result.interface.project_id] 
        });
      }
      
      if (result.interface.id) {
        queryClient.invalidateQueries({ 
          queryKey: ['interface-by-id', result.interface.id] 
        });
      }
      
      if (result.tab.interface_id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', result.tab.interface_id] 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', result.tab.interface_id] 
        });
      }
      
      // Invalidate tile queries
      if (result.tab.id) {
        queryClient.invalidateQueries({ 
          queryKey: ['tiles', result.tab.id] 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['tab-with-tiles-by-id', result.tab.id] 
        });
      }
    }
  });
} 