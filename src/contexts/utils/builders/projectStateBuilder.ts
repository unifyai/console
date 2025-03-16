import { Project } from "@/contexts/slices/selectors/project";
import { buildInterfaceState } from "./interfaceStateBuilder";
import { TableArguments } from "@/types/evals/logs";
import { Context, TabProps, TableDataProps, TabsDataProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";

/**
 * Build initial state for a project with its interfaces
 */
export function buildProjectState(
  currentProjectId: string | null,
  currentProjectName: string | null,
  currentInterfaceId: string,
  currentTabId: string | null,
  contexts: Context[],
  tabs: Record<string, TabProps>,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
) {
  const project: Project = {
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
        tabs,
        tabsData,
        tableData,
        plotData,
        tableArguments,
        limit,
        offsets,
      )
    }
  } as Project;

  return project;
}