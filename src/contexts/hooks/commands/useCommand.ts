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
import { Command, CommandCategory, CommandIcon } from "@/contexts/slices/selectors/commands";
import { useCreateProjectQuery } from "@/hooks/Interfaces/Query/useCreateProjectQuery";
import { useDeleteProjectQuery, useListProjectsQuery, useCreateOnlyProjectQuery } from "@/hooks/Interfaces/Query/useProjectsQuery";
import { ProjectsActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, TabProps, TileProps, FileActions, CodeActions, ContextActions, LogsActions } from "@/types/interfaces/grid";
import { defaultInterface, defaultTab, defaultTiles } from "@/constants/logs";
import { ResponseProps, FileProps } from "@/types/common";
import { useTab } from "@/contexts/hooks/tab";
import { useInterface } from "@/contexts/hooks/interface";
import { useRestoreLastSavedTabWithTilesQuery } from "@/hooks/Interfaces/Query/useRestoreLastSavedTabWithTilesQuery";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";

/**
 * Debug flag for command operations logging
 * Set NEXT_PUBLIC_DEBUG_COMMANDS=true to enable detailed command execution logs
 */
const DEBUG_COMMANDS = process.env.NEXT_PUBLIC_DEBUG_COMMANDS === 'true';

/**
 * Conditional debug logger for command operations
 */
const debugLog = (...args: any[]) => {
  if (DEBUG_COMMANDS) {
    console.log(...args);
  }
};

/**
 * Simplified arguments for useCommand
 */
export interface UseCommandArgs {
  /* IDs for retrieving state */
  projectId?: string | null;
  interfaceId?: string | null;
  tabId?: string | null;
  /* Router/query-param helpers */
  setProjectQueryParam?: (project: string | null) => void;
  setTabQueryParam?: (tab: string | null) => void;
  setInterfaceQueryParam?: (builtInterface: string | null) => void;
  setSelectProjectParam?: (value: string | null) => void; // ensure we can force project selection UI
   /* Server-side actions */
   projectActions: ProjectsActions;
   interfaceActions: GranularInterfaceActions;
   tabActions: GranularTabActions;
   tileActions: GranularTileActions;
   fileActions: FileActions;
   logsActions: LogsActions;
   contextActions: ContextActions;
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
    setProjectQueryParam,
    setTabQueryParam,
    setInterfaceQueryParam,
    setSelectProjectParam,
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    fileActions,
    logsActions,
    contextActions,
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
    if (!setProjectQueryParam || !setTabQueryParam || !setInterfaceQueryParam) return;

    const newProj = proj ? proj.path : null;
    debugLog("[selectProject] Starting project selection:", { newProj, currentProject: projectId });
    
    // Set UI state
    debugLog("[selectProject] Setting UI pending states");
    tabUIActions?.setPending(true);
    tabUIActions?.setDataPending(true);
    interfaceDataActions?.setTabNames([]);
    
    // Then fetch interfaces for this project if it's not null
    if (newProj && setInterfaceQueryParam) {
      try {
        debugLog("[selectProject] Fetching interfaces for project:", newProj);
        // Use the interfaceActions.list method to fetch interfaces
        const interfacesList = await interfaceActions.list(newProj);
        debugLog("[selectProject] Found interfaces:", interfacesList?.length || 0);
        
        // If interfaces exist, don't auto-select - let InterfaceSelector show
        if (interfacesList && interfacesList.length > 0) {
          debugLog("[selectProject] Interfaces exist, navigating to interface selector");
          setDemo(null);
          setTabQueryParam(null);
          setInterfaceQueryParam(null); // Don't auto-select interface
          setProjectQueryParam(newProj);
        } else {
          // No interfaces exist, let the interface selector page handle interface creation manually
          debugLog("[selectProject] No interfaces found, navigating to interface selector for manual creation");
          setDemo(null);
          setTabQueryParam(null);
          setInterfaceQueryParam(null);
          setProjectQueryParam(newProj);
        }
      } catch (error) {
        console.error("Error fetching interfaces for project", error);
        // On error, let the interface selector page handle interface creation manually
        debugLog("[selectProject] Error fetching interfaces, falling back to manual creation");
        setDemo(null);
        setTabQueryParam(null);
        setInterfaceQueryParam(null);
        setProjectQueryParam(newProj);
      }

      // Ensure project directory exists & has .env
      try {
        debugLog("[selectProject] Checking for .env file in project:", newProj);
        const res: any = await fileActions.list(newProj);
        const hasEnv = Array.isArray(res)
          ? res.some((e:any)=> (typeof e === "string" ? e === ".env" : e.name === ".env"))
          : Array.isArray(res.files) && res.files.some((e:any)=> (typeof e === "string" ? e === ".env" : e.name === ".env"));
        if (!hasEnv) {
          debugLog("[selectProject] Creating .env file for project:", newProj);
          await fileActions.write(newProj, { ".env": "" });
        } else {
          debugLog("[selectProject] .env file already exists");
        }
      } catch(e) {
        // Directory might not exist; create .env to implicitly create dir
        debugLog("[selectProject] Project directory may not exist, creating .env to initialize:", newProj);
        try { await fileActions.write(newProj, { ".env": "" }); } catch(_) {}
      }

      // Ensure .env file is not empty
      debugLog("[selectProject] Verifying .env file content");
      const res: any = await fileActions.read(newProj, ".env");
      const content = (res && typeof res === "object" && "content" in res) ? (res as any).content : "";
      if (content === "") {
        debugLog("[selectProject] .env file is empty, initializing with empty content");
        await fileActions.write(newProj, { ".env": "" });
      }
    } else {
      debugLog("[selectProject] No project selected or missing setInterfaceQueryParam, using demo mode");
      setDemo(null);
      setTabQueryParam("tab1");
      setInterfaceQueryParam("interface1");
      setProjectQueryParam(newProj);
      if (newProj) {
        try { await fileActions.write(newProj, { ".env": "" }); } catch(_) {}
      }
    }
    
    debugLog("[selectProject] Project selection completed:", newProj);
  }, [
    tabUIActions, 
    interfaceDataActions, 
    setDemo,
    setTabQueryParam, 
    setProjectQueryParam, 
    setInterfaceQueryParam, 
    interfaceActions,
    fileActions,
    projectId
  ]);

  const createProject = useCallback(async (name: string): Promise<ResponseProps> => {
    if (!setProjectQueryParam || !setTabQueryParam || !setInterfaceQueryParam) {
      return { error: "Missing required parameters" } as unknown as ResponseProps;
    }

    debugLog("[createProject] Starting project creation:", name);
    tabUIActions?.setPending(true);
    tabUIActions?.setDataPending(true);

    // First create the base project on the backend (simple project)
    debugLog("[createProject] Creating base project on backend");
    await createOnlyProjectMutation.mutateAsync({ name, actions: projectActions });

    // Immediately create an .env file in the new project
    try {
      debugLog("[createProject] Creating .env file for new project");
      await fileActions.write(name, { ".env": "" });
    } catch(e) { console.error("Failed to write .env", e); }

    // Prepare a default interface for the new project
    const newInterface = {
      ...defaultInterface,
      projectId: name,
    };
    debugLog("[createProject] Creating default interface:", newInterface.name);

    // Create interface, tab, tiles
    debugLog("[createProject] Creating interface, tab, and tiles");
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
    debugLog("[createProject] Updating UI state and local store");
    setDemo(null);
    setProjectQueryParam(name);
    setInterfaceQueryParam(defaultInterface.name);
    setTabQueryParam(defaultTab.name);
    interfaceDataActions?.setTabNames([defaultTab.name]);

    // Ensure local project list includes the new project
    setProjects([...projects, name]);
    debugLog("[createProject] Updated projects list, new count:", projects.length + 1);
    debugLog("[createProject] Project creation completed successfully:", name);
    return { info: "Project created successfully" } as unknown as ResponseProps;
  }, [
    createOnlyProjectMutation,
    createProjectMutation,
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    setDemo,
    setProjectQueryParam,
    setInterfaceQueryParam,
    tabUIActions,
    interfaceDataActions,
    setProjects,
    projects,
    fileActions
  ]);

  const closeProject = useCallback(() => {
    if (!setProjectQueryParam || !setTabQueryParam || !setInterfaceQueryParam) return;
    
    debugLog("[closeProject] Closing current project:", projectId);
    tabUIActions?.setPending(true);
    tabUIActions?.setDataPending(true);
    setTabQueryParam(null);
    interfaceDataActions?.setTabNames([]);
    setInterfaceQueryParam(null);
    setProjectQueryParam(null);
    // Explicitly request the project selection screen
    try {
      setSelectProjectParam?.('true');
    } catch {
      // Fallback to direct URL manipulation if needed
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('selectProject', 'true');
        window.history.pushState(window.history.state, '', url.toString());
      }
    }
    debugLog("[closeProject] Project closed, UI state reset");
  }, [
    tabUIActions, 
    setTabQueryParam, 
    interfaceDataActions, 
    setInterfaceQueryParam, 
    setProjectQueryParam,
    setSelectProjectParam,
    projectId
  ]);

  const deleteProject = useCallback(async (name: string): Promise<ResponseProps> => {
    debugLog("[deleteProject] Starting project deletion:", name);
    
    // Remove project directory via fileActions helper
    try {
      debugLog("[deleteProject] Deleting project directory");
      await fileActions.delete(name, "", true);
    } catch (e) {
      console.error("Failed to delete project directory", e);
    }
    
    debugLog("[deleteProject] Deleting project from backend");
    await deleteProjectMutation.mutateAsync({ name, actions: projectActions });

    // UI updates
    debugLog("[deleteProject] Updating UI and local state");
    closeProject();
    // Filter local list
    const newProjects = projects.filter((p) => p !== name);
    setProjects(newProjects);
    debugLog("[deleteProject] Updated projects list, new count:", newProjects.length);

    if (tabUIActions && setTabQueryParam && interfaceDataActions && setInterfaceQueryParam && setProjectQueryParam) {
      tabUIActions.setPending(true);
      tabUIActions.setDataPending(true);
      setTabQueryParam(null);
      interfaceDataActions.setTabNames([]);
      setInterfaceQueryParam(null);
      setProjectQueryParam(null);
    }

    debugLog("[deleteProject] Project deletion completed:", name);
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
    setProjectQueryParam,
    fileActions
  ]);

  const deleteProjectLogs = useCallback(async (name: string): Promise<ResponseProps> => {
    if (!logsActions) return { error: "Logs actions not configured." } as unknown as ResponseProps;

    debugLog("[deleteProjectLogs] Starting logs deletion for project:", name);
    try {
      // Passing null for context and empty array for idsAndFields to delete all logs in project.
      const result = await logsActions.delete(name, null, []);
      debugLog("[deleteProjectLogs] Logs deletion completed for project:", name);
      return result as ResponseProps;
    } catch (error) {
      console.error("Failed to delete project logs", error);
      return { error: "Failed to delete project logs" } as unknown as ResponseProps;
    }
  }, [logsActions]);

  const deleteProjectLogsAndContexts = useCallback(async (name: string): Promise<ResponseProps> => {
    if (!logsActions || !contextActions) return { error: "Logs or Context actions not configured." } as unknown as ResponseProps;

    debugLog("[deleteProjectLogsAndContexts] Starting logs and contexts deletion for project:", name);
    try {
      // 1. Delete all logs
      await logsActions.delete(name, null, []);
      debugLog("[deleteProjectLogsAndContexts] Logs deleted for project:", name);

      // 2. Get all contexts
      const contexts = await contextActions.get(name);
      debugLog("[deleteProjectLogsAndContexts] Found contexts to delete:", contexts.length);

      // 3. Delete all contexts in parallel
      await Promise.all(contexts.map(context => contextActions.delete(name, context.name)));
      debugLog("[deleteProjectLogsAndContexts] Contexts deleted for project:", name);
      
      return { info: "Logs and contexts deleted successfully" } as unknown as ResponseProps;
    } catch (error) {
      console.error("Failed to delete project logs and contexts", error);
      return { error: "Failed to delete project logs and contexts" } as unknown as ResponseProps;
    }
  }, [logsActions, contextActions]);

  const resetTabCommand = useCallback(async () => {
    if (!tabUIActions || !projectId || !interfaceId) {
      console.error("Cannot reset tab: missing required parameters");
      return;
    }
    
    debugLog("[resetTabCommand] Starting tab reset for project:", projectId, "interface:", interfaceId);
    
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
      
      // Use the updated restoration hook with the correct parameters
      debugLog("[resetTabCommand] Executing restoration mutation");

      // Perform the reset operation
      await restoreTabWithTilesMutation.mutateAsync({
        interfaceId: interfaceId,
        projectId: projectId,
        interfaceActions: interfaceActions,
        tabActions: tabActions,
        tileActions: tileActions
      });
      
      // Show success in overlay
      if (setOverlayState) {
        setOverlayState({
          isVisible: true,
          operation: 'resetting',
          status: 'success',
        });
      }
      
      debugLog("[resetTabCommand] Setting UI states after restoration");
      tabUIActions.setResetting(true);
      tabUIActions.setEdit(true);
      tabUIActions.setPending(false);
      
      // Refresh the UI
      debugLog("[resetTabCommand] Refreshing router");
      router.refresh();
      
      debugLog("[resetTabCommand] Tab reset completed successfully");
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
    debugLog("[setFileUpload] Setting file upload modal state:", fileUploadOpen);
    storeSetFileUploadOpen(fileUploadOpen);
  }

  const setFocusPane = (focusPaneOpen: boolean) => {
    debugLog("[setFocusPane] Setting focus pane state:", focusPaneOpen);
    storeSetFocusPaneOpen(focusPaneOpen);
  }

  const setGlobalContext = (globalContextOpen: boolean) => {
    debugLog("[setGlobalContext] Setting global context modal state:", globalContextOpen);
    storeSetGlobalContextOpen(globalContextOpen);
  }

  const setSaveInterface = (saveInterfaceOpen: boolean) => {
    debugLog("[setSaveInterface] Setting save interface modal state:", saveInterfaceOpen);
    storeSetSaveInterfaceOpen(saveInterfaceOpen);
  }

  /* -------------------------------------------------------------------------- */
  /* Build command list (metadata only – callbacks use hooks above)             */
  /* -------------------------------------------------------------------------- */

  const commands = useMemo<Command[]>(() => {
    const commandList: Command[] = [
      {
        id: "select-projects",
        label: "Select Projects",
        category: "project" as CommandCategory,
        icon: "Folder" as CommandIcon,
        disabled: false,
        action: (proj: FileProps | undefined) => {
          selectProject(proj);
        },
      },
      {
        id: "create-project",
        label: "Create Project",
        category: "project" as CommandCategory,
        icon: "Plus" as CommandIcon,
        disabled: false,
        action: (name: string) => {
          createProject(name);
        },
      },
      {
        id: "close-project",
        label: "Close Project",
        category: "project" as CommandCategory,
        icon: "X" as CommandIcon,
        disabled: !projectId,
        action: () => {
          closeProject();
        },
      },
      {
        id: "delete-project",
        label: "Delete Project",
        category: "project" as CommandCategory,
        icon: "Trash" as CommandIcon,
        disabled: !projectId,
        action: (name: string) => {
          deleteProject(name);
        },
      },
      {
        id: "file-upload",
        label: "Upload Files",
        category: "interface" as CommandCategory,
        icon: "Upload" as CommandIcon,
        disabled: !projectId,
        action: (fileUploadOpen: boolean) => {
          setFileUpload(fileUploadOpen);
        },
      },
      {
        id: "focus-pane",
        label: "Open Focus Pane",
        category: "interface" as CommandCategory,
        icon: "Focus" as CommandIcon,
        disabled: !projectId || !tabNames.length,
        action: (focusPaneOpen: boolean) => {
          setFocusPane(focusPaneOpen);
        },
      },
      {
        id: "global-context",
        label: "Edit Global Context",
        category: "interface" as CommandCategory,
        icon: "FolderTree" as CommandIcon,
        disabled: !projectId || !tabNames.length,
        action: (globalContextOpen: boolean) => {
          setGlobalContext(globalContextOpen);
        },
      },
      {
        id: "save-interface",
        label: "Save Tab",
        category: "interface" as CommandCategory,
        icon: "Save" as CommandIcon,
        disabled: !projectId || !tabNames.length,
        action: (saveInterfaceOpen: boolean) => {
          setSaveInterface(saveInterfaceOpen);
        },
      },
      {
        id: "reset-interface",
        label: "Reset Tab",
        category: "interface" as CommandCategory,
        icon: "ListRestart" as CommandIcon,
        disabled: !projectId || !tabNames.length || !tabId,
        action: () => {
          resetTabCommand();
        },
      }
    ];
    
    debugLog("[commands] Built command list with", commandList.length, "commands. Available commands:", 
      commandList.map(cmd => `${cmd.id}${cmd.disabled ? ' (disabled)' : ''}`).join(', '));
    
    return commandList;
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
      debugLog("[useEffect] Updating store commands. Previous count:", storeCommands.length, "New count:", commands.length);
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
    debugLog("[mapCommandToAction] Mapping command ID to action:", commandId);
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
        debugLog("[mapCommandToAction] Unknown command ID:", commandId);
        return null;
    }
  };

  return {
    commands,
    selectProject,
    createProject,
    closeProject,
    deleteProject,
    deleteProjectLogs,
    deleteProjectLogsAndContexts,
    resetTab: resetTabCommand,
    setFileUpload,
    setFocusPane,
    setGlobalContext,
    setSaveInterface,
    listProjectsQuery,
    mapCommandToAction
  } as const;
} 