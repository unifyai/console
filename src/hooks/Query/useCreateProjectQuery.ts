"use client";

import { useMutation } from '@tanstack/react-query';
import { 
  InterfaceData, 
  TabData, 
  TileData, 
  GranularInterfaceActions, 
  GranularTabActions, 
  GranularTileActions,
} from '@/types/evals/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Input interface for the project creation process
 */
export interface ProjectCreationInput {
  interface: Omit<InterfaceData, 'id' | 'created_at' | 'updated_at'> & {
    project_id: string; // Make project_id required for creation
  };
  tab: Omit<TabData, 'id' | 'interface_id' | 'created_at' | 'updated_at'>;
  tiles?: TileData[];
  actions: {
    interfaceActions: GranularInterfaceActions;
    tabActions: GranularTabActions;
    tileActions: GranularTileActions;
  };
}

/**
 * Result interface for the project creation process
 */
export interface ProjectCreationResult {
  interface: InterfaceData;
  tab: TabData;
  tiles: TileData[];
}

/**
 * A hook to create a complete project with interface, tab, and tiles
 */
export function useCreateProjectQuery() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: ProjectCreationInput): Promise<ProjectCreationResult> => {
      const { 
        interface: projectInterface, 
        tab: projectTab, 
        tiles = [], // Default to empty array if not provided
        actions
      } = input;
      
      try {
        // Step 1: Create interface
        if (!projectInterface.project_id) {
          throw new Error("Interface must have project_id defined");
        }
        
        if (!projectInterface.name && projectInterface.name !== "") {
          throw new Error("Interface must have name defined");
        }
        
        const { project_id, name, ...interfaceProps } = projectInterface;
        
        // Create the interface
        const createdInterface = await actions.interfaceActions.create(
          project_id, 
          name, 
          interfaceProps.color
        );
        
        // Step 2: Create tab under the interface
        if (!projectTab.name) {
          throw new Error("Tab must have name defined");
        }
        
        const { name: tabName, ...tabProps } = projectTab;
        
        // Create the tab
        const createdTab = await actions.tabActions.create(
          createdInterface.id || "", 
          tabName, 
          tabProps
        );
        
        // Step 3: Create tiles if any are provided
        const createdTiles = await Promise.all(
          tiles.map(tile => {
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
              terminal_tile?: typeof tile.terminal_tile;
            } = {};
            
            if (tile.table_tile) specializedData.table_tile = tile.table_tile;
            if (tile.plot_tile) specializedData.plot_tile = tile.plot_tile;
            if (tile.view_tile) specializedData.view_tile = tile.view_tile;
            if (tile.editor_tile) specializedData.editor_tile = tile.editor_tile;
            if (tile.terminal_tile) specializedData.terminal_tile = tile.terminal_tile;
            
            // Remove specialized data and server-generated props from tileProps to avoid duplication
            const { 
              table_tile, plot_tile, view_tile, editor_tile, terminal_tile,
              id, tab_id, created_at, updated_at, ...restTileProps 
            } = tileProps;
            
            // Prepare tile data with all available properties
            const tileData = {
              ...restTileProps,
              ...specializedData
            };
            
            return actions.tileActions.create(
              createdTab.id || "", 
              tileName, 
              position, 
              tileData,
              undefined,
              type, 
            );
          })
        );
        
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
          if (projectInterface.project_id) {
            // This is a simplification - ideally you'd use proper deletion
            // through the interface actions
            console.error("Error creating project, attempting cleanup:", error);
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