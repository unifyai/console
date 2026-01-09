"use client";

import { useMutation } from '@tanstack/react-query';
import { 
  InterfaceData, 
  TabData, 
  TileData, 
  GranularInterfaceActions, 
  GranularTabActions, 
  GranularTileActions,
} from '@/types/interfaces/grid';
import { useQueryClient } from "@tanstack/react-query";

/**
 * Input interface for the project creation process
 */
export interface ProjectCreationInput {
  interface: Omit<InterfaceData, 'id' | 'createdAt' | 'updatedAt'> & {
    projectId: string; // Make projectId required for creation
  };
  tab: Omit<TabData, 'id' | 'interfaceId' | 'createdAt' | 'updatedAt'>;
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
        if (!projectInterface.projectId) {
          throw new Error("Interface must have projectId defined");
        }
        
        if (!projectInterface.name && projectInterface.name !== "") {
          throw new Error("Interface must have name defined");
        }
        
        const { projectId, name, ...interfaceProps } = projectInterface;
        
        // Create the interface
        const createdInterface = await actions.interfaceActions.create(
          projectId, 
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
              tableTile, plotTile, viewTile, editorTile, terminalTile,
              id, tabId, createdAt, updatedAt, ...restTileProps 
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
          if (projectInterface.projectId) {
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
      if (result.interface.projectId) {
        queryClient.invalidateQueries({ 
          queryKey: ['interfaces', result.interface.projectId] 
        });
      }
      
      if (result.interface.id) {
        queryClient.invalidateQueries({ 
          queryKey: ['interface-by-id', result.interface.id] 
        });
      }
      
      if (result.tab.interfaceId) {
        queryClient.invalidateQueries({ 
          queryKey: ['tabs', result.tab.interfaceId] 
        });
        
        queryClient.invalidateQueries({ 
          queryKey: ['interface-with-tabs', result.tab.interfaceId] 
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