import { StateCreator } from "zustand";
import { ProjectsActions, TabActions } from "@/types/evals/grid";
import { StoreSlice } from "./slice";
import { defaultItems, defaultNewCounter } from "@/constants/logs";
import { FileProps, ResponseProps } from "@/types/common";

export interface Command {
    id: string;
    label: string;
    description?: string;
    action: (name?: string | FileProps | undefined) => Promise<ResponseProps>;
    onAction?: () => Promise<void>;
    disabled: boolean;
    category: "project" | "interface";
    icon?: string;
}

export interface CommandsState {
    // State
    commands: Command[];
}

export interface CommandsActions {
    // Actions
    updateCommands: (
        projectActions: ProjectsActions,
        tabActions: TabActions,
        project: string | null,
        tabNames: string[],
        setProject: (project: string | null) => void,
        setTab: (tab: string | null) => void,
        interfaceUIActions: any,
        interfaceDataActions: any,
        projects: string[],
        setProjects: (projects: string[]) => void
    ) => void;
}

export type CommandsSlice = CommandsState & CommandsActions;

export const createCommandsSlice: StateCreator<
    StoreSlice,
    [["zustand/immer", never]],
    [],
    CommandsSlice
> = (set) => ({
    commands: [],
    updateCommands: (
        projectActions,
        tabActions,
        project,
        tabNames,
        setProject,
        setTabQueryParam,
        interfaceUIActions,
        interfaceDataActions,
        projects,
        setProjects
    ) => {
        // Only update if the commands array is empty
        set((state) => {
            if (state.commands.length === 0) {
                return {
                    commands: [
                        {
                            id: "select-projects",
                            label: "Select projects",
                            action: (proj: FileProps | undefined) => {
                                const newProj = proj ? proj.path : null;
                                interfaceUIActions?.setPending(true);
                                interfaceUIActions?.setDataPending(true);
                                interfaceDataActions?.setTabNames([]);
                                setTabQueryParam(null);
                                setProject(newProj);
                            },
                            disabled: false,
                            category: "project",
                            icon: "Folder"
                        },
                        {
                            id: "create-project",
                            label: "Create project",
                            action: async (name: string) => {
                                return await projectActions.create(name).then(async () => {
                                    await tabActions.create(
                                        "tab1", name, undefined, defaultItems, defaultNewCounter, true, undefined
                                    );
                                    const tabCreate = await tabActions.create(
                                        "tab1", name, undefined, defaultItems, defaultNewCounter, false, undefined
                                    );
                                    setProject(name);
                                    setTabQueryParam("tab1");
                                    interfaceUIActions?.setPending(true);
                                    interfaceUIActions?.setDataPending(true);
                                    interfaceDataActions?.setTabNames(["tab1"]);
                                    setProjects([...projects, name]);
                                    return tabCreate;
                                });
                            },
                            disabled: false,
                            category: "project",
                            icon: "Plus"
                        },
                        {
                            id: "close-project",
                            label: "Close project",
                            action: () => {
                                interfaceUIActions?.setPending(true);
                                interfaceUIActions?.setDataPending(true);
                                setTabQueryParam(null);
                                interfaceDataActions?.setTabNames([]);
                                setProject(null);
                            },
                            disabled: !project,
                            category: "project",
                            icon: "X"
                        },
                        {
                            id: "delete-project",
                            label: "Delete project",
                            action: async () => {
                                await Promise.all(tabNames.map(tabName => tabActions.delete(
                                    tabName, project as string, true
                                )))
                                await Promise.all(tabNames.map(tabName => tabActions.delete(
                                    tabName, project as string, false
                                )))
                                return await projectActions.delete(project as string);
                            },
                            onAction: () => {
                                interfaceUIActions?.setPending(true);
                                interfaceUIActions?.setDataPending(true);
                                setTabQueryParam(null);
                                interfaceDataActions?.setTabNames([]);
                                setProject(null);
                                projectActions.get().then(projects => setProjects(projects));
                            },
                            disabled: !project,
                            category: "project",
                            icon: "Trash"
                        }
                    ]
                };
            }
            return state;
        });
    }
}); 