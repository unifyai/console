import { Tab, TabMeta, TabData as TabSliceData, TabUI } from "@/contexts/slices/selectors/tab";
import { TabData, TabProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build tab state from API-returned tab data
 * This no longer depends on buildTileState
 */
export function buildTabState(
  tabData: TabData,
  tableArguments: TableArguments = {},
  isActive: boolean = false,
  savedTab?: TabProps | null
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
    // We'll set these based on our app's knowledge, not from the API
    tabCreated: true, 
    tempTabCreated: false,
  };
  
  // Create tab data - initially empty tile collections
  // These will be populated as tiles are added to the store
  const tabSliceData: TabSliceData = {
    tileIds: [],
    globalContext: tabData.global_context,
    savedTab: savedTab || null,
    itemsNeedRecompute: false,
    tableArguments,
  };
  
  // Create tab UI
  const tabUI: TabUI = {
    projectId: null, // Will be derived from the interface if needed
    interfaceId: tabData.interface_id || null,
    focusedTileNames: [undefined, undefined],
    resetting: false,
    edit: true,
    interactive: true,
    help: true,
    deleting: false,
    refreshing: false,
    color: tabData.color,
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
  tileId: string
): Tab {
  // Don't duplicate tile IDs
  if (tabState.tileIds.includes(tileId)) {
    return tabState;
  }
  
  return {
    ...tabState,
    tileIds: [...tabState.tileIds, tileId],
  };
}

/**
 * Update a tab with project and interface IDs
 */
export function updateTabParentReferences(
  tabState: Tab,
  projectId: string | null,
  interfaceId: string | null
): Tab {
  return {
    ...tabState,
    projectId,
    interfaceId,
  };
}
  