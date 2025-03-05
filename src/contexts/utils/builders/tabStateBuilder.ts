import { PlotDataProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { buildPlotTileState, buildTableTileState, buildTileState } from "./tileStateBuilder";
import { Tab } from "@/contexts/slices/selectors/tab";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build initial state for a tab with its tiles
 */
export function buildTabState(
  tabId: string,
  tabData: any,
  defaultProjectId: string,
  isActive: boolean = false,
  order: number = 1,
  tableData: TableDataProps = {},
  tableArguments: TableArguments = {},
  plotData: PlotDataProps = {},
  limit: number,
  offsets: number[],
) {
  // Create a proper savedTab value that exactly matches TabProps from grid.ts
  const savedTabValue = {
    name: tabData.name || tabId,
    project: defaultProjectId,
    context: tabData.context || "",
    items: tabData.items || [],
    new_counter: tabData.new_counter || 0
  };
  
  // Create basic tab structure
  const tab = {
    id: tabId,
    name: tabData.name || tabId,
    visible: true,
    active: isActive,
    order: order,
    context: tabData.context || "",
    tabCreated: tabData.tabCreated || false,
    tempTabCreated: tabData.tempTabCreated || false,
    savedTab: savedTabValue,
    focusedTileIds: [undefined, undefined],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tiles: {} as Record<string, any>
  } as Tab;
  
  // If we have table tiles, add them
  if (Array.isArray(tabData.tableTiles)) {
    tabData.tableTiles.forEach((tile: any, index: number) => {
      tab.tiles[tile.i] = buildTableTileState(
        tile.i,
        tile,
        tableData,
        tableArguments,
        limit,
        offsets,
        index
      );
    });
  }
  
  // If we have plot tiles, add them
  if (Array.isArray(tabData.plotTiles)) {
    tabData.plotTiles.forEach((tile: any) => {
      tab.tiles[tile.i] = buildPlotTileState(tile.i, tile, plotData);
    });
  }
  
  // Process tiles from items array if present
  if (tabData.items) {
    // Handle both array and object formats
    const itemsEntries = Array.isArray(tabData.items) 
      ? tabData.items.map((item: any) => [item.i, item])
      : Object.entries(tabData.items);
    
    itemsEntries.forEach(([tileId, tileData]: [string, any]) => {
      // Only add if not already added as a table or plot tile
      if (!tab.tiles[tileId]) {
        // Determine tile type from tab property or type property
        const tileType = tileData.tab ? tileData.tab : tileData.type || 'Table';
        tab.tiles[tileId] = buildTileState(
          tileId, 
          tileData, 
          tileType
        );
      }
    });
  }
  
  return tab;
}
  