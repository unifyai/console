import { Context, TabProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";
import { IStoreState } from "../store";
import { buildProjectState } from "./builders/projectStateBuilder";

/**
 * Build complete initial state for the store
 */
export function buildInitialState(
  defaultProjectId: string,
  defaultInterfaceId: string,
  currentTabId: string,
  tabsData: any = {},
  currentProject: string | null = null,
  tableData: TableDataProps = {},
  tableArguments: TableArguments = {},
  plotData: PlotDataProps = {},
  limit: number,
  offsets: number[],
  contexts: Context[] = [],
  tabs: Record<string, TabProps> = {}
) {
  return {
    // Main hierarchical structure
    projectsById: {
      [defaultProjectId]: buildProjectState(
        defaultProjectId,
        currentProject || "Default Project",
        defaultInterfaceId,
        currentTabId,
        tabsData,
        tableData,
        tableArguments,
        plotData,
        limit,
        offsets,
        contexts,
        tabs
      )
    },

    // Global active states for navigation
    activeProjectId: defaultProjectId,
    activeInterfaceId: defaultInterfaceId,
    activeTabId: currentTabId,
    
    // Initialize projects list (for backward compatibility with IStoreState)
    projects: [defaultProjectId]
  } as Partial<IStoreState>;
}