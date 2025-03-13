import { Project } from "@/contexts/slices/selectors/project";
import { buildInterfaceState } from "./interfaceStateBuilder";
import { TableArguments } from "@/types/evals/logs";
import { Context, TabProps, TableDataProps, TabsDataProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";

/**
 * Build initial state for a project with its interfaces
 */
export function buildProjectState(
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
    id: currentProjectId,
    name: currentProjectName,
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contexts: contexts || [],
    activeInterfaceId: currentInterfaceId,
    interfaces: {
      [currentInterfaceId]: buildInterfaceState(
        currentInterfaceId,
        currentTabId,
        tabsData,
        tableData,
        plotData,
        tableArguments,
        limit,
        offsets,
        tabs
      )
    }
  } as Project;
}