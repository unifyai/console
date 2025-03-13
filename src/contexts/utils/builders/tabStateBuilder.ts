import { PlotDataProps, TabProps, TabsDataProps, TileProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { buildPlotTileState, buildTableTileState, buildTileState, buildViewTileState } from "./tileStateBuilder";
import { Tab } from "@/contexts/slices/selectors/tab";

/**
 * Build initial state for a tab with its tiles
 */
export function buildTabState(
  currentTabId: string,
  tabData: TabsDataProps[keyof TabsDataProps],
  tableData: TableDataProps = {},
  plotData: PlotDataProps = {},
  limit: number,
  offsets: number[],
  isActive: boolean = false,
  order: number = 1,
) {
  // Create a proper savedTab value that exactly matches TabProps from grid.ts
  const savedTabValue: TabProps | null = tabData.savedTab || null;
  
  // Create basic tab structure
  const tab = {
    id: currentTabId,
    name: tabData.name || currentTabId,
    visible: true,
    active: isActive,
    order: order,
    context: tabData.context,
    tabCreated: tabData.tabCreated || false,
    tempTabCreated: tabData.tempTabCreated || false,
    savedTab: savedTabValue,
    focusedTileIds: [undefined, undefined],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),

    // resetting: false,
    edit: true,
    interactive: true,
    // deleting: false,
    // dataPending: false,
    // pending: true,
    // refreshing: false,

    tiles: {}
  } as Tab;

  // If we have table tiles, add them
  if (Array.isArray(tabData.tableTiles)) {
    tabData.tableTiles.forEach((tileProps: TileProps, index: number) => {
      tab.tiles[tileProps.i] = buildTableTileState(
        tileProps,
        tableData,
        limit,
        offsets,
        index,
        tabData.context
      );
    });
  }
  
  // If we have plot tiles, add them
  if (Array.isArray(tabData.plotTiles)) {
    tabData.plotTiles.forEach((tileProps: TileProps) => {
      tab.tiles[tileProps.i] = buildPlotTileState(tileProps, plotData, tabData.context);
    });
  }

  // If we have view tiles, add them
  if (Array.isArray(tabData.viewTiles)) {
    tabData.viewTiles.forEach((tileProps: TileProps) => {
      tab.tiles[tileProps.i] = buildViewTileState(tileProps, tabData.context);
    });
  }
  
  // Process tiles from items array if present
  if (tabData.items) {
    tabData.items.forEach((tileProps: TileProps) => {
      // Only add if not already added as a table or plot tile
      if (!tab.tiles[tileProps.i]) {
        // Determine tile type from tab property or type property
        const tileType = tileProps.tab as "Table" | "Plot" | "View" | undefined;
        tab.tiles[tileProps.i] = buildTileState(
          tileProps, 
          tileType,
          tabData.context
        );
      }
    });
  }
  
  return tab;
}
  