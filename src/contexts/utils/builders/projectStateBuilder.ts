import { Project, ProjectMeta, ProjectData, ProjectUI, initProject } from "@/contexts/slices/selectors/project";
import { Interface } from "@/contexts/slices/selectors/interface";
import { Tab } from "@/contexts/slices/selectors/tab";
import { Tile } from "@/contexts/slices/selectors/tile";
import { buildInterfaceState } from "./interfaceStateBuilder";
import { TableArguments } from "@/types/evals/logs";
import { Context, TabProps, TableDataProps, TabsDataProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";

/**
 * Build initial state for a project with its interfaces
 * @returns Object with the project and all related entities
 */
export function buildProjectState(
  tabName: string | null,
  tabNames: string[],
  interfaceId: string,
  projectId: string | null,
  projectName: string | null,
  contexts: Context[],
  tabs: Record<string, TabProps>,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
) {
  if (!projectId) {
    return { project: null, interfaces: {}, tabs: {}, tiles: {} };
  }

  // Initialize collections for the result
  const interfacesById: Record<string, Interface> = {};
  const tabsById: Record<string, Tab> = {};
  const tilesById: Record<string, Tile> = {};
  const interfaceIds: string[] = [];
  
  // Add the current interface
  interfaceIds.push(interfaceId);
  
  const { interface: interfaceObj, tabs: interfaceTabs, tiles: interfaceTiles } = buildInterfaceState(
    tabName,
    tabNames,
    interfaceId,
    projectId,
    tabs,
    tabsData,
    tableData,
    plotData,
    tableArguments,
    limit,
    offsets,
  );
  
  if (interfaceObj) {
    interfacesById[interfaceId] = interfaceObj;
    // Merge the tabs and tiles
    Object.assign(tabsById, interfaceTabs);
    Object.assign(tilesById, interfaceTiles);
  }
  
  // Create project meta
  const projectMeta: ProjectMeta = {
    id: projectId,
    name: projectName,
    // createdAt: new Date().toISOString(),
    // updatedAt: new Date().toISOString(),
  };
  
  // Create project data
  const projectData: ProjectData = {
    description: "",
    contexts: contexts || [],
    interfaceIds: interfaceIds,
  };
  
  // Create project UI
  const projectUI: ProjectUI = {
    activeInterfaceId: interfaceId,
  };
  
  // Create the complete project
  const project: Project = {
    ...projectMeta,
    ...projectData,
    ...projectUI,
  };
  
  return { project, interfaces: interfacesById, tabs: tabsById, tiles: tilesById };
}