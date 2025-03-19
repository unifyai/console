import { StateCreator } from "zustand";

// Import slices
import { GlobalSlice, createGlobalSlice, GlobalState, GlobalActions } from "./globalSlice";
import { ProjectSlice, createProjectSlice, ProjectState, ProjectActions } from "./projectSlice";
import { InterfaceSlice, createInterfaceSlice, InterfaceState, InterfaceActions } from "./interfaceSlice";
import { TabSlice, createTabSlice, TabState, TabActions } from "./tabSlice";
import { TileSlice, createTileSlice, TileState, TileActions } from "./tileSlice";
import { TableTileSlice, createTableTileSlice, TableTileState, TableTileActions } from "./tableTileSlice";
import { PlotTileSlice, createPlotTileSlice, PlotTileState, PlotTileActions } from "./plotTileSlice";
import { ViewTileSlice, createViewTileSlice, ViewTileState, ViewTileActions } from "./viewTileSlice";

// Re-export the types from the domain logic
export type { Project } from "./selectors/project";
export type { Interface } from "./selectors/interface";
export type { Tab } from "./selectors/tab";

// Combined top-level state interface
export interface StoreState extends 
  GlobalState,
  ProjectState,
  InterfaceState,
  TabState,
  TileState,
  TableTileState,
  PlotTileState,
  ViewTileState {}

// Combined actions interface
export interface StoreActions extends
  GlobalActions,
  ProjectActions,
  InterfaceActions,
  TabActions,
  TileActions,
  TableTileActions,
  PlotTileActions,
  ViewTileActions {}

// Combined slice type
export type StoreSlice = StoreState & StoreActions;

// Create the final combined store slice using the slices pattern
export const createStoreSlice: StateCreator<
  StoreSlice,
  [["zustand/immer", never]],
  [],
  StoreSlice
> = (...a) => ({
  ...createGlobalSlice(...a),
  ...createProjectSlice(...a),
  ...createInterfaceSlice(...a),
  ...createTabSlice(...a),
  ...createTileSlice(...a),
  ...createTableTileSlice(...a),
  ...createPlotTileSlice(...a),
  ...createViewTileSlice(...a),
}); 