import { Project } from "@/contexts/slices/selectors/project";
import { buildInterfaceState } from "./interfaceStateBuilder";
import { TableArguments } from "@/types/evals/logs";
import { Context, TabProps, TableDataProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";

/**
 * Build initial state for a project with its interfaces
 */
export function buildProjectState(
  projectId: string,
  projectName: string,
  interfaceId: string,
  currentTabId: string,
  tabsData: any = {},
  tableData: TableDataProps = {},
  plotData: PlotDataProps = {},
  tableArguments: TableArguments = {},
  limit: number,
  offsets: number[],
  contexts: Context[] = [],
  tabs: Record<string, TabProps> = {}
) {
  return {
    id: projectId,
    name: projectName || "Default Project",
    description: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    contexts: contexts || [],
    activeInterfaceId: interfaceId,
    interfaces: {
      [interfaceId]: buildInterfaceState(
        interfaceId,
        currentTabId,
        tabsData,
        projectId,
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