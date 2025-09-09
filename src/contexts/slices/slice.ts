import { StateCreator } from "zustand";

// Import slices
import { createGlobalSlice, GlobalState, GlobalActions } from "./globalSlice";
import { createCommandsSlice, CommandsState, CommandsActions } from "./commandsSlice";
import { createProjectSlice, ProjectState, ProjectActions } from "./projectSlice";
import { createInterfaceSlice, InterfaceState, InterfaceActions } from "./interfaceSlice";
import { createTabSlice, TabState, TabActions } from "./tabSlice";
import { createTileSlice, TileState, TileActions } from "./tileSlice";
import { createTableTileSlice, TableTileState, TableTileActions } from "./tableTileSlice";
import { createPlotTileSlice, PlotTileState, PlotTileActions } from "./plotTileSlice";
import { createViewTileSlice, ViewTileState, ViewTileActions } from "./viewTileSlice";
import { createEditorTileSlice, EditorTileState, EditorTileActions } from "./editorTileSlice";
import { createTerminalTileSlice, TerminalTileState, TerminalTileActions } from "./terminalTileSlice";
import { createAsyncSlice, AsyncState, AsyncActions } from "./asyncSlice";
import { createContextsSlice, ContextsState, ContextsActions } from "./contextsSlice";

// Re-export the types from the domain logic
export type { Project } from "./selectors/project";
export type { Interface } from "./selectors/interface";
export type { Tab } from "./selectors/tab";

// Combined top-level state interface
export interface StoreState extends 
  GlobalState,
  CommandsState,
  ProjectState,
  InterfaceState,
  TabState,
  TileState,
  TableTileState,
  PlotTileState,
  ViewTileState,
  EditorTileState,
  TerminalTileState,
  AsyncState,
  ContextsState {}

// Combined actions interface
export interface StoreActions extends
  GlobalActions,
  CommandsActions,
  ProjectActions,
  InterfaceActions,
  TabActions,
  TileActions,
  TableTileActions,
  PlotTileActions,
  ViewTileActions,
  EditorTileActions,
  TerminalTileActions,
  AsyncActions,
  ContextsActions {}

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
  ...createCommandsSlice(...a),
  ...createProjectSlice(...a),
  ...createInterfaceSlice(...a),
  ...createTabSlice(...a),
  ...createTileSlice(...a),
  ...createTableTileSlice(...a),
  ...createPlotTileSlice(...a),
  ...createViewTileSlice(...a),
  ...createEditorTileSlice(...a),
  ...createTerminalTileSlice(...a),
  ...createAsyncSlice(...a),
  ...createContextsSlice(...a),
}); 