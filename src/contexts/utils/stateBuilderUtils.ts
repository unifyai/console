import { Context, TabProps, TabsDataProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";
import { IStoreState } from "../store";
import { buildProjectState } from "./builders/projectStateBuilder";

/**
 * Build complete initial state for the store
 */
export function buildInitialState(
  currentProjectId: string,
  currentProjectName: string,
  currentInterfaceId: string,
  currentTabId: string,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
  contexts: Context[],
  tabs: Record<string, TabProps>
) {
  return {
    // Main hierarchical structure
    projectsById: {
      [currentProjectId]: buildProjectState(
        currentProjectId,
        currentProjectName,
        currentInterfaceId,
        currentTabId,
        tabsData,
        tableData,
        plotData,
        tableArguments,
        limit,
        offsets,
        contexts,
        tabs
      )
    },

    // Global active states for navigation
    activeProjectId: currentProjectId,
    activeInterfaceId: currentInterfaceId,
    activeTabId: currentTabId,
    
    // Initialize projects list (for backward compatibility with IStoreState)
    projects: [currentProjectId]
  } as Partial<IStoreState>;
}