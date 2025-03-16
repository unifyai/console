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
  currentProjectId: string | null,
  currentProjectName: string | null,
  currentInterfaceId: string,
  currentTabId: string | null,
  projects: string[],
  contexts: Context[],
  tabs: Record<string, TabProps>,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
) {
    const storeState: Partial<IStoreState> = {
      // Global active states for navigation
      activeProjectId: currentProjectId,
      activeInterfaceId: currentInterfaceId,
      activeTabId: currentTabId,

      // Global states
      projects: projects,

      // Main hierarchical structure
      projectsById: {},
    }

      
    // Global states
    // Main hierarchical structure
    if (currentProjectId) {
      storeState.projectsById = {
        [currentProjectId]: buildProjectState(
          currentProjectId,
          currentProjectName,
          currentInterfaceId,
          currentTabId,
          contexts,
          tabs,
          tabsData,
          tableData,
          plotData,
          tableArguments,
          limit,
          offsets,
        )
      }
    }

    return storeState;
}