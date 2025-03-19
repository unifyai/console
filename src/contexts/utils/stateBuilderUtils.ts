import { Context, TabProps, TabsDataProps } from "@/types/evals/grid";
import { PlotDataProps } from "@/types/evals/grid";
import { TableDataProps } from "@/types/evals/grid";
import { TableArguments } from "@/types/evals/logs";
import { IStoreState } from "../store";
import { buildProjectState } from "./builders/projectStateBuilder";
import { StoreState } from "../slices/slice";

/**
 * Build complete initial state for the store
 */
export function buildInitialState(
  tabName: string | null,
  interfaceName: string,
  projectName: string | null,
  projectsList: string[],
  contexts: Context[],
  tabProps: Record<string, TabProps>,
  tabsData: TabsDataProps,
  tableData: TableDataProps,
  plotData: PlotDataProps,
  tableArguments: TableArguments,
  limit: number,
  offsets: number[],
): Partial<IStoreState> {
  // Construct the hierarchical IDs
  const projectId = projectName ? `${projectName}` : null;
  const interfaceId = projectId ? `${projectId}>${interfaceName}` : interfaceName;
  const tabId = projectId && interfaceId && tabName ? `${interfaceId}>${tabName}` : null;

  // Initialize the store state with default empty values
  const storeState: Partial<StoreState> = {
    // Global active states for navigation
    activeProjectId: projectId,
    activeInterfaceId: interfaceId,
    activeTabId: tabId,

    // Global states
    projects: projectsList,

    // Flattened dictionaries for each entity type
    projectsById: {},
    interfacesById: {},
    tabsById: {},
    tilesById: {},
  };

  // If we have a current project, build its state
  if (projectId) {
    const { 
      project, 
      interfaces: interfacesById, 
      tabs: tabsById, 
      tiles: tilesById 
    } = buildProjectState(
      tabName,
      interfaceId,
      projectId,
      projectName,
      contexts,
      tabProps,
      tabsData,
      tableData,
      plotData,
      tableArguments,
      limit,
      offsets,
    );

    // Add project to the store
    if (project) {
      storeState.projectsById = {
        [projectId]: project
      };
    }

    // Add interfaces to the store
    if (interfacesById && Object.keys(interfacesById).length > 0) {
      storeState.interfacesById = interfacesById;
    }

    // Add tabs to the store
    if (tabsById && Object.keys(tabsById).length > 0) {
      storeState.tabsById = tabsById;
    }

    // Add tiles to the store
    if (tilesById && Object.keys(tilesById).length > 0) {
      storeState.tilesById = tilesById;
    }
  }

  return storeState;
}