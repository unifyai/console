import { Tab, TabMeta, TabData, TabUI } from "@/contexts/slices/selectors/tab";
import { Tile } from "@/contexts/slices/selectors/tile";
import { PlotDataProps, TabProps, TabsDataProps, TileProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { buildEditorTileState, buildPlotTileState, buildTableTileState, buildTileState, buildViewTileState } from "./tileStateBuilder";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build initial state for a tab with its tiles
 * @returns Object containing the tab and a dictionary of its tiles
 */
export function buildTabState(
  tabId: string | null,
  interfaceId: string | null = null,
  projectId: string | null = null,
  tabData: TabsDataProps[keyof TabsDataProps],
  tableData: TableDataProps = {},
  plotData: PlotDataProps = {},
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
  isActive: boolean = false,
  order: number = 1,
): { tab: Partial<Tab>, tiles: Record<string, Tile> } {
  if (!tabId) {
    return {
      tab: {},
      tiles: {},
    }
  }

  // Create a proper savedTab value that exactly matches TabProps from grid.ts
  const savedTabValue: TabProps | null = tabData.savedTab || null;
  
  // Initialize an empty tiles dictionary to collect all tiles
  const tilesById: Record<string, Tile> = {};
  
  // Initialize an array to collect tile IDs
  const tileIds: string[] = [];

  // Create tile ID generator function
  const createTileId = (tileProps: TileProps): string => {
    const baseId = tileProps.i;
    // Check if the ID already has the hierarchical format
    if (baseId.includes('>')) {
      return baseId;
    }
    // Create hierarchical ID: projectId>interfaceId>tabId>tileId
    return `${tabId}>${baseId}`;
  };
  
  // Process table tiles
  if (Array.isArray(tabData.tableTiles)) {
    tabData.tableTiles.forEach((tileProps: TileProps, index: number) => {
      const tileId = createTileId(tileProps);
      tileIds.push(tileId);
      
      tilesById[tileId] = buildTableTileState(
        tabId,
        interfaceId,
        projectId,
        tileProps,
        tableData,
        limit,
        offsets,
        index,
      );
    });
  }
  
  // Process plot tiles
  if (Array.isArray(tabData.plotTiles)) {
    tabData.plotTiles.forEach((tileProps: TileProps) => {
      const tileId = createTileId(tileProps);
      tileIds.push(tileId);
      
      tilesById[tileId] = buildPlotTileState(
        tabId,
        interfaceId,
        projectId,
        tileProps,
        plotData,
      );
    });
  }

  // Process view tiles
  if (Array.isArray(tabData.viewTiles)) {
    tabData.viewTiles.forEach((tileProps: TileProps) => {
      const tileId = createTileId(tileProps);
      tileIds.push(tileId);
      
      tilesById[tileId] = buildViewTileState(
        tabId,
        interfaceId,
        projectId,
        tileProps,
      );
    });
  }

  // Process editor tiles
  if (Array.isArray(tabData.editorTiles)) {
    tabData.editorTiles.forEach((tileProps: TileProps) => {
      const tileId = createTileId(tileProps);
      tileIds.push(tileId);
      
      tilesById[tileId] = buildEditorTileState(
        tabId,
        interfaceId,
        projectId,
        tileProps,
      );
    });
  }
  
  // Process tiles from items array if present
  if (tabData.items) {
    tabData.items.forEach((tileProps: TileProps) => {
      const tileId = createTileId(tileProps);
      
      // Only add if not already added as a table or plot tile
      if (!tileIds.includes(tileId)) {
        tileIds.push(tileId);
        
        // Determine tile type
        const tileType = tileProps.tab as "Table" | "Plot" | "View" | "Editor" | null;
        
        tilesById[tileId] = buildTileState(
          tabId,
          interfaceId,
          projectId,
          tileProps,
          tileType,
        );
      }
    });
  }
  
  // Create tab meta
  const tabMeta: TabMeta = {
    id: tabId,
    name: tabData.name,
    visible: true,
    active: isActive,
    order: order,
    tabCreated: tabData.tabCreated || false,
    tempTabCreated: tabData.tempTabCreated || false,
    // createdAt: new Date().toISOString(),
    // updatedAt: new Date().toISOString(),
  };
  
  // Create tab data
  const tabData2: TabData = {
    tileIds: tileIds,
    globalContext: tabData.globalContext,
    savedTab: savedTabValue,
    itemsNeedRecompute: false,
    tableArguments: tableArguments,
  };
  
  // Create tab UI
  const tabUI: Partial<TabUI> = {
    projectId,
    interfaceId,
    focusedTileNames: [undefined, undefined],
    resetting: false,
    edit: true,
    interactive: true,
    help: true,
    deleting: false,
    refreshing: false,
    color: tabData.savedTab?.color
  };
  
  // Create the complete tab
  const tab: Partial<Tab> = {
    ...tabMeta,
    ...tabData2,
    ...tabUI,
  };
  
  return { tab, tiles: tilesById };
}
  