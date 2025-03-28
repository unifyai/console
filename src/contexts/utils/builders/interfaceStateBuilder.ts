import { Interface, InterfaceMeta, InterfaceData, InterfaceUI, initInterface } from "@/contexts/slices/selectors/interface";
import { Tab } from "@/contexts/slices/selectors/tab";
import { Tile } from "@/contexts/slices/selectors/tile";
import { buildTabState } from "./tabStateBuilder";
import { PlotDataProps, TabProps, TabsDataProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build initial state for an interface with its tabs
 * @returns Object with the interface, tabs and tiles
 */
export function buildInterfaceState(
  tabName: string | null,
  interfaceId: string,
  projectId: string | null = null,
  tabs: Record<string, TabProps>,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
) {
  if (!interfaceId) {
    return { interface: null, tabs: {}, tiles: {} };
  }

  // Initialize collections for the result
  const tabsById: Record<string, Tab> = {};
  const tilesById: Record<string, Tile> = {};
  const tabNames: string[] = [];
  const tabIds: string[] = [];

  const tabId = tabName ? `${interfaceId}>${tabName}` : null;

  // Add current active tab
  if (tabId && tabName) {
    tabIds.push(tabId);
    tabNames.push(tabName);
    
    const { tab, tiles } = buildTabState(
      tabId,
      interfaceId,
      projectId,
      tabsData[tabId],
      tableData,
      plotData,
      tableArguments,
      limit,
      offsets,
      true, // Active
      1, // First order
    );
    
    if (tab) {
      tabsById[tabId] = tab as Tab;
      // Merge the tiles into our collection
      Object.assign(tilesById, tiles);
    }
  }

  // Add other tabs from tabsData
  Object.entries(tabsData).forEach(([tabId_, tabData]: [string, any]) => {
    const tabName = tabData.name;
    if (tabId_ !== tabId && (tabs && tabName in tabs)) {
      if (!tabIds.includes(tabId_)) {
        tabIds.push(tabId_);
        tabNames.push(tabName);
        
        const order = tabIds.length;
        const { tab, tiles } = buildTabState(
          tabId_,
          projectId,
          interfaceId,
          tabData,
          tableData,
          plotData,
          tableArguments,
          limit,
          offsets,
          false, // Not active
          order,
        );
        
        if (tab) {
          tabsById[tabId_] = tab as Tab;
          // Merge the tiles into our collection
          Object.assign(tilesById, tiles);
        }
      }
    }
  });
  
  // Create interface meta
  const interfaceMeta: InterfaceMeta = {
    id: interfaceId,
    name: "Default Interface",
    // createdAt: new Date().toISOString(),
    // updatedAt: new Date().toISOString(),
  };
  
  // Create interface data
  const interfaceData: InterfaceData = {
    tabIds: tabIds,
    tabNames: tabNames,
  };
  
  // Create interface UI
  const interfaceUI: InterfaceUI = {
    projectId,
    activeTabId: tabId ? tabId : null,
  };
  
  // Create the complete interface
  const interfaceObj: Interface = {
    ...interfaceMeta,
    ...interfaceData,
    ...interfaceUI,
  };
  
  return { interface: interfaceObj, tabs: tabsById, tiles: tilesById };
}
