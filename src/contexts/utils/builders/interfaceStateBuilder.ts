import { Interface } from "@/contexts/slices/selectors/interface";
import { buildTabState } from "./tabStateBuilder";
import { PlotDataProps, TabProps, TabsDataProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";

/**
 * Build initial state for an interface with its tabs
 */
export function buildInterfaceState(
  currentInterfaceId: string,
  currentTabId: string,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
  tabs: Record<string, TabProps>
) {
  // Create interface structure
  const iface = {
    id: currentInterfaceId,
    name: "Default Interface",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    activeTabId: currentTabId,
    tabIds: [],
    tabs: {} as Record<string, any>,
    tableArguments: tableArguments,
  } as Interface;

  // Add current active tab
  iface.tabs[currentTabId] = buildTabState(
    currentTabId,
    tabsData[currentTabId],
    tableData,
    plotData,
    limit,
    offsets,
    true, // Active
    1, // First order
  );

  // Add other tabs from tabsData
  Object.entries(tabsData).forEach(([tabId, tabData]: [string, any]) => {
    if (tabId !== currentTabId && (tabs && tabId in tabs)) {
      const order = Object.keys(iface.tabs).length + 1;
      iface.tabs[tabId] = buildTabState(
        tabId,
        tabData,
        tableData,
        plotData,
        limit,
        offsets,
        false, // Not active
        order,
      );
    }
  });

  // Add tabIds to the interface state
  iface.tabIds = Object.keys(iface.tabs).sort();

  return iface;
}
