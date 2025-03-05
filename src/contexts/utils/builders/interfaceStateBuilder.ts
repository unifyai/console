import { Interface } from "@/contexts/slices/selectors/interface";
import { buildTabState } from "./tabStateBuilder";
import { PlotDataProps, TabProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build initial state for an interface with its tabs
 */
export function buildInterfaceState(
  interfaceId: string,
  currentTabId: string,
  tabsData: any = {},
  defaultProjectId: string,
  tableData: TableDataProps = {},
  tableArguments: TableArguments = {},
  plotData: PlotDataProps = {},
  limit: number,
  offsets: number[],
  tabs: Record<string, TabProps> = {}
) {
  // Create interface structure
  const iface = {
    id: interfaceId,
    name: "Default Interface",
    pending: false,
    refreshing: false,
    deleting: false,
    dataPending: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeTabId: currentTabId,
    tabIds: [],
    tabs: {} as Record<string, any>
  } as Interface;
  
  // Add current active tab if it exists in tabsData
  if (tabsData[currentTabId]) {
    iface.tabs[currentTabId] = buildTabState(
      currentTabId,
      tabsData[currentTabId],
      defaultProjectId,
      true, // Active
      1, // First order
      tableData,
      tableArguments,
      plotData,
      limit,
      offsets,
    );
  } else {
    // Create a default tab if it doesn't exist
    iface.tabs[currentTabId] = buildTabState(
      currentTabId,
      { name: currentTabId },
      defaultProjectId,
      true, // Active
      1, // First order
      tableData,
      tableArguments,
      plotData,
      limit,
      offsets,
    );
  }
  
  // Add other tabs from tabsData
  Object.entries(tabsData).forEach(([tabId, tabData]: [string, any]) => {
    if (tabId !== currentTabId && !(tabs && tabId in tabs)) {
      const order = Object.keys(iface.tabs).length + 1;
      iface.tabs[tabId] = buildTabState(
        tabId,
        tabData,
        defaultProjectId,
        false, // Not active
        order,
        tableData,
        tableArguments,
        plotData,
        limit,
        offsets,
      );
    }
  });

  return iface;
}
