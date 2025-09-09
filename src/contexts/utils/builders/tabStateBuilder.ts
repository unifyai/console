import { Tab, TabMeta, TabData as TabSliceData, TabUI } from "@/contexts/slices/selectors/tab";
import { TabData } from "@/types/interfaces/grid";

/**
 * Build tab state from API-returned tab data
 * This no longer depends on buildTileState
 */
export function buildTabState(
  tabData: TabData,
  isActive: boolean = false,
  tileIds: string[] = [],
  tileNames: string[] = []
): Tab {
  if (!tabData || !tabData.id) {
    throw new Error("Invalid tab data provided");
  }
  
  // Create tab meta
  const tabMeta: TabMeta = {
    id: tabData.id,
    name: tabData.name,
    visible: tabData.visible ?? true,
    active: isActive,
    order: tabData.order ?? 1,
  };
  
  // Create tab data - initially empty tile collections
  // These will be populated as tiles are added to the store
  const tabSliceData: TabSliceData = {
    tileIds: tileIds,
    tileNames: tileNames,
    globalContext: tabData.context,
    itemsNeedRecompute: false,
  };
  
  // Create tab UI
  const tabUI: TabUI = {
    interfaceId: tabData.interface_id || null,
    focusedTileNames: [undefined, undefined],
    resetting: false,
    edit: false,
    interactive: true,
    help: true,
    deleting: false,
    refreshing: false,
    color: tabData.color,
    editTile: undefined,
    dataPending: false,
    pending: false,
  };
  
  return {
    ...tabMeta,
    ...tabSliceData,
    ...tabUI,
  };
}

/**
 * Add a tile to a tab state
 */
export function addTileToTab(
  tabState: Tab, 
  tileId: string,
  tileName: string
): Tab {
  // Don't duplicate tile IDs
  if (tabState.tileIds.includes(tileId)) {
    return tabState;
  }
  
  return {
    ...tabState,
    tileIds: [...tabState.tileIds, tileId],
    tileNames: [...tabState.tileNames, tileName],
  };
}

/**
 * Update a tab with project and interface IDs
 */
export function updateTabParentReferences(
  tabState: Tab,
  interfaceId: string | null
): Tab {
  return {
    ...tabState,
    interfaceId,
  } as Tab;
}
  