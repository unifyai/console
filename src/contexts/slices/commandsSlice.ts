import { StateCreator } from "zustand";
import { StoreSlice } from "./slice";
import { Command, CommandCategory, CommandIcon } from "./selectors/commands";
import { ProjectsActions, GranularInterfaceActions, GranularTabActions, GranularTileActions } from "@/types/evals/grid";
import { TabUIActions } from "../hooks/tab";
import { InterfaceDataActions } from "../hooks/interface/useInterfaceData";

// ----------------------------------------------------------------------------------
// State & Actions Types
// ----------------------------------------------------------------------------------

export interface CommandsState {
    // Flat list of available commands
    commands: Command[];
}

export interface CommandsActions {
    /** Set the entire commands list */
    setCommands: (cmds: Command[]) => void;
    /** Add a single command */
    addCommand: (cmd: Command) => void;
    /** Remove a command by ID */
    removeCommand: (id: string) => void;
    /** Initialize all commands with dependencies */
    updateCommands: (
        projectActions: ProjectsActions,
        interfaceActions: GranularInterfaceActions,
        tabActions: GranularTabActions,
        tileActions: GranularTileActions,
        project: string | null,
        tabNames: string[],
        projects: string[],
        setProject: (project: string | null) => void,
        setTabQueryParam: (tab: string | null) => void,
        setInterfaceQueryParam: (interface_: string | null) => void,
        interfaceDataActions: InterfaceDataActions | null,
        tabUIActions: TabUIActions | null,
        setProjects: (projects: string[]) => void,
        resetTab: () => void
    ) => void;
}

export type CommandsSlice = CommandsState & CommandsActions;

// ----------------------------------------------------------------------------------
// Slice Factory
// ----------------------------------------------------------------------------------

export const createCommandsSlice: StateCreator<
    StoreSlice,
    [["zustand/immer", never]],
    [],
    CommandsSlice
> = (set, get) => ({
    // ------------------------------
    // Initial State
    // ------------------------------
    commands: [],

    // ------------------------------
    // Actions
    // ------------------------------
    setCommands: (cmds) =>
        set((state) => {
            state.commands = cmds;
        }),

    addCommand: (cmd) =>
        set((state) => {
            state.commands.push(cmd);
        }),

    removeCommand: (id) =>
        set((state) => {
            state.commands = state.commands.filter((c) => c.id !== id);
        }),
        
    updateCommands: (
        projectActions,
        interfaceActions,
        tabActions,
        tileActions,
        project,
        tabNames,
        projects,
        setProject,
        setTabQueryParam,
        setInterfaceQueryParam,
        interfaceDataActions,
        tabUIActions,
        setProjects,
        resetTab
    ) => {
        // Only update if the commands array is empty or outdated
        if (get().commands.length === 0) {
            set((state) => {
                state.commands = [
                    {
                        id: "select-projects",
                        label: "Select Projects",
                        category: "project" as CommandCategory,
                        icon: "Folder" as CommandIcon,
                        disabled: false
                    },
                    {
                        id: "create-project",
                        label: "Create Project",
                        category: "project" as CommandCategory,
                        icon: "Plus" as CommandIcon,
                        disabled: false
                    },
                    {
                        id: "close-project",
                        label: "Close Project",
                        category: "project" as CommandCategory,
                        icon: "X" as CommandIcon,
                        disabled: !project
                    },
                    {
                        id: "delete-project",
                        label: "Delete Project",
                        category: "project" as CommandCategory,
                        icon: "Trash" as CommandIcon,
                        disabled: !project
                    },
                    {
                        id: "file-upload",
                        label: "Upload Files",
                        category: "interface" as CommandCategory,
                        icon: "Upload" as CommandIcon,
                        disabled: !project
                    },
                    {
                        id: "focus-pane",
                        label: "Open focus pane",
                        category: "interface" as CommandCategory,
                        icon: "Focus" as CommandIcon,
                        disabled: !project || !tabNames.length
                    },
                    {
                        id: "global-context",
                        label: "Edit global context",
                        category: "interface" as CommandCategory,
                        icon: "FolderTree" as CommandIcon,
                        disabled: !project || !tabNames.length
                    },
                    {
                        id: "save-interface",
                        label: "Save interface",
                        category: "interface" as CommandCategory,
                        icon: "Save" as CommandIcon,
                        disabled: !project || !tabNames.length
                    },
                    {
                        id: "reset-tab",
                        label: "Reset interface",
                        category: "interface" as CommandCategory,
                        icon: "ListRestart" as CommandIcon,
                        disabled: !project || !tabNames.length
                    }
                ];
            });
        } else {
            // Just update the disabled states based on current conditions
            set((state) => {
                state.commands = state.commands.map(cmd => {
                    switch (cmd.id) {
                        case "close-project":
                        case "delete-project":
                        case "file-upload":
                            return { ...cmd, disabled: !project };
                        case "focus-pane":
                        case "global-context":
                        case "save-interface":
                        case "reset-tab":
                            return { ...cmd, disabled: !project || !tabNames.length };
                        default:
                            return cmd;
                    }
                });
            });
        }
    }
}); 