/*
 * Hook – useCommand
 *
 * A thin wrapper that exposes high-level command helpers (create project, delete project, etc.)
 * while automatically updating the zustand Commands slice so that the UI can render a
 * contextual Command Palette or similar menu.
 *
 * This intentionally mirrors the behaviour that previously lived inside `ProjectButtons.tsx`
 * but keeps the business-logic inside a dedicated hook that can be reused anywhere.
 */

"use client";

import { useCallback, useMemo, useEffect } from "react";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { Command } from "@/contexts/slices/selectors/commands";
import { useCreateProjectQuery } from "@/hooks/Query/useCreateProjectQuery";
import { useDeleteProjectQuery, useListProjectsQuery, useCreateOnlyProjectQuery } from "@/hooks/Query/useProjectsQuery";
import { ProjectsActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, TabProps, TileProps, FileActions, CodeActions } from "@/types/evals/grid";
import { defaultInterface, defaultTab, defaultTiles } from "@/constants/logs";
import { ResponseProps, FileProps } from "@/types/common";
import { useTab } from "@/contexts/hooks/tab";
import { useInterface } from "@/contexts/hooks/interface";
import { useRestoreLastSavedTabWithTilesQuery } from "@/hooks/Query/useRestoreLastSavedTabWithTilesQuery";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";

/**
 * Simplified arguments for useCommand
 */
export interface UseCommandArgs {
  /* IDs for retrieving state */
  projectId?: string | null;
  interfaceId?: string | null;
  tabId?: string | null;
  /* Router/query-param helpers */
  setProject?: (project: string | null) => void;
  setTabQueryParam?: (tab: string | null) => void;
  setInterfaceQueryParam?: (interface_: string | null) => void;
   /* Server-side actions */
   projectActions: ProjectsActions;
   interfaceActions: GranularInterfaceActions;
   tabActions: GranularTabActions;
   tileActions: GranularTileActions;
   fileActions: FileActions;
   codeActions: CodeActions;
   /* Overlay state setter for save/reset operations */
   setOverlayState?: (state: {
     isVisible: boolean;
     operation: 'saving' | 'resetting' | null;
     status: 'loading' | 'success' | 'error' | null;
   }) => void;
}

/**
 * Hook that provides command actions for use in the UI
 * and automatically updates the Commands state in the store.
 */
export function useCommand(args: UseCommandArgs) {
  const {
    projectId,
    interfaceId,
    tabId,
    setProject,
    setTabQueryParam,
    setInterfaceQueryParam,
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    fileActions,
    codeActions,
    setOverlayState,
  } = args;

  const router = useRouter();

  // Query params
  const [_, setDemo] = useQueryState("demo");

  /* -------------------------------------------------------------------------- */
  /* Zustand store access                                                       */
  /* -------------------------------------------------------------------------- */
  const storeSetCommands = useStoreContext((s) => s.setCommands);
  const projects = useStoreContext((s) => s.projects);
  const setProjects = useStoreContext((s) => s.setProjects);
  const storeCommands = useStoreContext((s) => s.commands);

  const storeSetFileUploadOpen = useStoreContext(s => s.setFileUploadOpen);
  const storeSetFocusPaneOpen = useStoreContext(s => s.setFocusPaneOpen);
  const storeSetGlobalContextOpen = useStoreContext(s => s.setGlobalContextOpen);
  const storeSetSaveInterfaceOpen = useStoreContext(s => s.setSaveInterfaceOpen);

  /* -------------------------------------------------------------------------- */
  /* React-Query hooks                                                          */
  /* -------------------------------------------------------------------------- */
  const createProjectMutation = useCreateProjectQuery();
  const deleteProjectMutation = useDeleteProjectQuery();
  const listProjectsQuery = useListProjectsQuery(projectActions);
  const createOnlyProjectMutation = useCreateOnlyProjectQuery();
  const restoreTabWithTilesMutation = useRestoreLastSavedTabWithTilesQuery();

  /* -------------------------------------------------------------------------- */
  /* Related hooks for state/actions                                            */
  /* -------------------------------------------------------------------------- */
  // Get interface data actions
  const { dataActions: interfaceDataActions } = useInterface(interfaceId || "");
  const tabNames = interfaceDataActions?.getTabNames() || [];

  // Get tab actions
  const { uiActions: tabUIActions } = useTab(tabId || "", interfaceId || "");

  /* -------------------------------------------------------------------------- */
  /* Command helpers                                                            */
  /* -------------------------------------------------------------------------- */

  const selectProject = useCallback(async (proj: FileProps | undefined) => {
    if (!setProject || !setTabQueryParam || !setInterfaceQueryParam) return;

    const newProj = proj ? proj.path : null;
    
    // Set UI state
    tabUIActions?.setPending(true);
    tabUIActions?.setDataPending(true);
    interfaceDataActions?.setTabNames([]);
    
    // Then fetch interfaces for this project if it's not null
    if (newProj && setInterfaceQueryParam) {
      try {
        // Use the interfaceActions.list method to fetch interfaces
        const interfacesList = await interfaceActions.list(newProj);
        
        // If interfaces exist, don't auto-select - let InterfaceSelector show
        if (interfacesList && interfacesList.length > 0) {
          setDemo(null);
          setTabQueryParam(null);
          setInterfaceQueryParam(null); // Don't auto-select interface
          setProject(newProj);
        } else {
          // No interfaces exist, create default
          setDemo(null);
          setTabQueryParam("tab1");
          setInterfaceQueryParam("interface1");
          setProject(newProj);
        }
      } catch (error) {
        console.error("Error fetching interfaces for project", error);
        // On error, create default
        setDemo(null);
        setTabQueryParam("tab1");
        setInterfaceQueryParam("interface1");
        setProject(newProj);
      }

      // Ensure project directory exists & has .env
      try {
        const res: any = await fileActions.list(newProj);
        const hasEnv = Array.isArray(res)
          ? res.some((e:any)=> (typeof e === "string" ? e === ".env" : e.name === ".env"))
          : Array.isArray(res.files) && res.files.some((e:any)=> (typeof e === "string" ? e === ".env" : e.name === ".env"));
        if (!hasEnv) {
          await fileActions.write(newProj, { ".env": "" });
        }
      } catch(e) {
        // Directory might not exist; create .env to implicitly create dir
        try { await fileActions.write(newProj, { ".env": "" }); } catch(_) {}
      }

      // Ensure .env file is not empty
      const res: any = await fileActions.read(newProj, ".env");
      const content = (res && typeof res === "object" && "content" in res) ? (res as any).content : "";
      if (content === "") {
        await fileActions.write(newProj, { ".env": "" });
      }
    } else {
      setDemo(null);
      setTabQueryParam("tab1");
      setInterfaceQueryParam("interface1");
      setProject(newProj);
      if (newProj) {
        try { await fileActions.write(newProj, { ".env": "" }); } catch(_) {}
      }
    }
  }, [
    tabUIActions, 
    interfaceDataActions, 
    setDemo,
    setTabQueryParam, 
    setProject, 
    setInterfaceQueryParam, 
    interfaceActions,
    fileActions
  ]);

  const createProject = useCallback(async (name: string): Promise<ResponseProps> => {
    if (!setProject || !setTabQueryParam || !setInterfaceQueryParam) {
      return { error: "Missing required parameters" } as unknown as ResponseProps;
    }

    // First create the base project on the backend (simple project)
    await createOnlyProjectMutation.mutateAsync({ name, actions: projectActions });

    // Immediately create an .env file in the new project
    try {
      await fileActions.write(name, { ".env": "" });
    } catch(e) { console.error("Failed to write .env", e); }

    // Prepare a default interface for the new project
    const newInterface = {
      ...defaultInterface,
      project_id: name,
    };

    // Create interface, tab, tiles
    await createProjectMutation.mutateAsync({
      interface: newInterface,
      tab: defaultTab,
      tiles: defaultTiles,
      actions: {
        interfaceActions,
        tabActions,
        tileActions,
      },
    });

    // Update UI & local store
    setDemo(null);
    setProject(name);
    setInterfaceQueryParam("interface1");
    setTabQueryParam("tab1");
    tabUIActions?.setPending(true);
    tabUIActions?.setDataPending(true);
    interfaceDataActions?.setTabNames(["tab1"]);

    // Ensure local project list includes the new project
    setProjects([...projects, name]);

    return { info: "Project created successfully" } as unknown as ResponseProps;
  }, [
    createOnlyProjectMutation,
    createProjectMutation,
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    setDemo,
    setProject,
    setInterfaceQueryParam,
    setTabQueryParam,
    tabUIActions,
    interfaceDataActions,
    setProjects,
    projects,
    fileActions
  ]);

  const closeProject = useCallback(() => {
    if (!setProject || !setTabQueryParam || !setInterfaceQueryParam) return;
    
    tabUIActions?.setPending(true);
    tabUIActions?.setDataPending(true);
    setTabQueryParam(null);
    interfaceDataActions?.setTabNames([]);
    setInterfaceQueryParam(null);
    setProject(null);
  }, [
    tabUIActions, 
    setTabQueryParam, 
    interfaceDataActions, 
    setInterfaceQueryParam, 
    setProject
  ]);

  const deleteProject = useCallback(async (name: string): Promise<ResponseProps> => {
    // Remove project directory via fileActions helper
    try {
      await fileActions.delete(name, "", true);
    } catch (e) {
      console.error("Failed to delete project directory", e);
    }
    
    await deleteProjectMutation.mutateAsync({ name, actions: projectActions });

    // UI updates
    closeProject();
    // Filter local list
    setProjects(projects.filter((p) => p !== name));

    if (tabUIActions && setTabQueryParam && interfaceDataActions && setInterfaceQueryParam && setProject) {
      tabUIActions.setPending(true);
      tabUIActions.setDataPending(true);
      setTabQueryParam(null);
      interfaceDataActions.setTabNames([]);
      setInterfaceQueryParam(null);
      setProject(null);
    }

    return { info: "Project deleted successfully" } as unknown as ResponseProps;
  }, [
    deleteProjectMutation, 
    projectActions, 
    closeProject, 
    setProjects, 
    projects,
    tabUIActions,
    interfaceDataActions,
    setTabQueryParam,
    setInterfaceQueryParam,
    setProject,
    fileActions
  ]);

  const resetTabCommand = useCallback(async () => {
    if (!tabUIActions || !projectId || !interfaceId) {
      console.error("Cannot reset tab: missing required parameters");
      return;
    }
    
    try {
      tabUIActions.setPending(true);
      
      // Show overlay if available
      if (setOverlayState) {
        setOverlayState({
          isVisible: true,
          operation: 'resetting',
          status: 'loading',
        });
      }
      
      // Perform the reset operation
      await restoreTabWithTilesMutation.mutateAsync({
        interface_id: interfaceId,
        project_id: projectId,
        interface_actions: interfaceActions,
        tab_actions: tabActions,
        tile_actions: tileActions
      });
      
      // Show success in overlay
      if (setOverlayState) {
        setOverlayState({
          isVisible: true,
          operation: 'resetting',
          status: 'success',
        });
      }
      
      tabUIActions.setResetting(true);
      tabUIActions.setEdit(true);
      tabUIActions.setPending(false);
      
      // Refresh the UI
      router.refresh();
      
    } catch (error) {
      console.error("Failed to restore from checkpoints:", error);
      
      // Show error in overlay
      if (setOverlayState) {
        setOverlayState({
          isVisible: true,
          operation: 'resetting',
          status: 'error',
        });
      }
      
      tabUIActions.setPending(false);
    }
  }, [
    projectId, 
    interfaceId, 
    tabUIActions, 
    restoreTabWithTilesMutation, 
    interfaceActions, 
    tabActions, 
    tileActions,
    router,
    setOverlayState
  ]);

  const setFileUpload = (fileUploadOpen: boolean) => {
    storeSetFileUploadOpen(fileUploadOpen);
  }

  const setFocusPane = (focusPaneOpen: boolean) => {
    storeSetFocusPaneOpen(focusPaneOpen);
  }

  const setGlobalContext = (globalContextOpen: boolean) => {
    storeSetGlobalContextOpen(globalContextOpen);
  }

  const setSaveInterface = (saveInterfaceOpen: boolean) => {
    storeSetSaveInterfaceOpen(saveInterfaceOpen);
  }

  /* -------------------------------------------------------------------------- */
  /* Build command list (metadata only – callbacks use hooks above)             */
  /* -------------------------------------------------------------------------- */

  const commands = useMemo<Command[]>(() => {
    return [
      {
        id: "select-projects",
        label: "Select Projects",
        category: "project",
        icon: "Folder",
        disabled: false,
        action: (proj) => {
          selectProject(proj);
        },
      },
      {
        id: "create-project",
        label: "Create Project",
        category: "project",
        icon: "Plus",
        disabled: false,
        action: (name: string) => {
          createProject(name);
        },
      },
      {
        id: "close-project",
        label: "Close Project",
        category: "project",
        icon: "X",
        disabled: !projectId,
        action: () => {
          closeProject();
        },
      },
      {
        id: "delete-project",
        label: "Delete Project",
        category: "project",
        icon: "Trash",
        disabled: !projectId,
        action: (name: string) => {
          deleteProject(name);
        },
      },
      {
        id: "file-upload",
        label: "Upload Files",
        category: "interface",
        icon: "Upload",
        disabled: !projectId,
        action: (fileUploadOpen: boolean) => {
          setFileUpload(fileUploadOpen);
        },
      },
      {
        id: "focus-pane",
        label: "Open Focus Pane",
        category: "interface",
        icon: "Focus",
        disabled: !projectId || !tabNames.length,
        action: (focusPaneOpen: boolean) => {
          setFocusPane(focusPaneOpen);
        },
      },
      {
        id: "global-context",
        label: "Edit Global Context",
        category: "interface",
        icon: "FolderTree",
        disabled: !projectId || !tabNames.length,
        action: (globalContextOpen: boolean) => {
          setGlobalContext(globalContextOpen);
        },
      },
      {
        id: "save-interface",
        label: "Save Tab",
        category: "interface",
        icon: "Save",
        disabled: !projectId || !tabNames.length,
        action: (saveInterfaceOpen: boolean) => {
          setSaveInterface(saveInterfaceOpen);
        },
      },
      {
        id: "reset-interface",
        label: "Reset Tab",
        category: "interface",
        icon: "ListRestart",
        disabled: !projectId || !tabNames.length || !tabId,
        action: () => {
          resetTabCommand();
        },
      }
    ];
  }, [
    projectId,
    tabNames,
    tabId,
    selectProject,
    createProject,
    closeProject,
    deleteProject,
    setFileUpload,
    setFocusPane,
    setGlobalContext,
    setSaveInterface,
    resetTabCommand
  ]);

  // Keep the zustand slice in-sync whenever `commands` changes
  useEffect(() => {
    if (commands.length > 0 && (!storeCommands.length || storeCommands.length !== commands.length)) {
      storeSetCommands(commands);
    }
  }, [commands, storeCommands.length, storeSetCommands]);

  /* -------------------------------------------------------------------------- */
  /* Public API                                                                 */
  /* -------------------------------------------------------------------------- */

  /**
   * Map a command ID to its implementation
   */
  const mapCommandToAction = (commandId: string) => {
    switch (commandId) {
      case "select-projects":
        return selectProject;
      case "create-project":
        return createProject;
      case "close-project":
        return closeProject;
      case "delete-project":
        return deleteProject;
      case "file-upload":
        return setFileUpload;
      case "focus-pane":
        return setFocusPane;
      case "global-context":
        return setGlobalContext;
      case "save-interface":
        return setSaveInterface;
      case "reset-interface":
        return resetTabCommand;
      default:
        return null;
    }
  };

  return {
    commands,
    selectProject,
    createProject,
    closeProject,
    deleteProject,
    resetTab: resetTabCommand,
    setFileUpload,
    setFocusPane,
    setGlobalContext,
    setSaveInterface,
    listProjectsQuery,
    mapCommandToAction
  } as const;
} 