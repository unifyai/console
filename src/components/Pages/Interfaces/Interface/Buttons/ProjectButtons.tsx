"use client";

import React from "react";
import { FolderCog, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProject from "../../Blocks/Table/Buttons/CreateProject";
import CloseProject from "../../Blocks/Table/Buttons/CloseProject";
import FileDirectory from "../../../../Shared/Tree/Directory/FileDirectory";
import { ResponseProps } from "@/types/common";
import { ProjectsActions, GranularInterfaceActions, GranularTabActions, GranularTileActions, FileActions, CodeActions, LogsActions, ContextActions } from "@/types/interfaces/grid";
import ActionButton from "../../../../Common/Buttons/Action";
import { useEffect, useState } from "react";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTabUI } from "@/contexts/hooks/tab";
import AutoComplete from "../../../../Common/Misc/AutoComplete";
import BaseDropdown from "../../../../Common/Dropdowns/Base";
import { useCommand } from "@/contexts/hooks/commands/useCommand";
import DeleteProjectDialog from "./DeleteProject";
import { useListProjectsQuery } from "@/hooks/Interfaces/Query/useProjectsQuery";


const ProjectButtons = ({
    tabIdOrName,
    interfaceId,
    projectQueryParam,
    defaultProject,
    setProjectQueryParam,
    setInterfaceQueryParam,
    setTabQueryParam,
    projectActions,
    interfaceActions,
    tabActions,
    tileActions,
    fileActions,
    logsActions,
    contextActions,
    codeActions,
    setOverlayState,
}: {
    tabIdOrName: string | null;
    interfaceId: string;
    projectQueryParam: string | null;
    defaultProject: boolean,
    setProjectQueryParam: (project: string | null) => void;
    setInterfaceQueryParam: (interface_: string | null) => void;
    setTabQueryParam: (tab: string | null) => void;
    projectActions: ProjectsActions;
    interfaceActions: GranularInterfaceActions;
    tabActions: GranularTabActions;
    tileActions: GranularTileActions;
    fileActions: FileActions;
    logsActions: LogsActions;
    contextActions: ContextActions;
    codeActions: CodeActions;
    setOverlayState: React.Dispatch<React.SetStateAction<{
        isVisible: boolean;
        operation: 'saving' | 'resetting' | 'refreshing' | null;
        status: 'loading' | 'success' | 'error' | null;
    }>>;
}) => {
    const router = useRouter();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    
    // State for dialog controls
    const selectProjectsOpen = useStoreContext((s) => s.selectProjectsOpen);
    const setSelectProjectsOpen = useStoreContext((s) => s.setSelectProjectsOpen);
    const createProjectOpen = useStoreContext((s) => s.createProjectOpen);
    const setCreateProjectOpen = useStoreContext((s) => s.setCreateProjectOpen);
    const deleteProjectOpen = useStoreContext((s) => s.deleteProjectOpen);
    const setDeleteProjectOpen = useStoreContext((s) => s.setDeleteProjectOpen);
    
    // Global states
    const project = projectQueryParam;
    const projects = useStoreContext((s) => s.projects);
    const projectsData = projects.map((p: string) => ({ path: p, type: "file" }));
    const setProjects = useStoreContext((s) => s.setProjects);

    // Interface states and actions with granular access
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabIdOrName || "");

    // Use React Query to load projects
    const listProjectsQuery = useListProjectsQuery(projectActions);
    
    // Initialize command hooks with minimal parameters
    const commandHooks = useCommand({
        projectId: project,
        interfaceId,
        tabId: tabIdOrName,
        setProjectQueryParam,
        setTabQueryParam,
        setInterfaceQueryParam,
        projectActions,
        interfaceActions,
        tabActions,
        tileActions,
        fileActions,
        logsActions,
        contextActions,
        codeActions,
    });
    
    const { 
        selectProject: selectProjectCommand, 
        createProject: createProjectCommand, 
        closeProject: closeProjectCommand, 
        deleteProject: deleteProjectCommand,
        deleteProjectLogs: deleteProjectLogsCommand,
        deleteProjectLogsAndContexts: deleteProjectLogsAndContextsCommand
    } = commandHooks;

    // Use React Query to load projects
    useEffect(() => {
        if (listProjectsQuery.data) {
            setProjects(listProjectsQuery.data);
        }
    }, [listProjectsQuery.data, setProjects]);

    const onOpen = () => {
        // Refetch projects using React Query
        listProjectsQuery.refetch();
    }

    useEffect(() => {
        if (selectProjectsOpen || createProjectOpen || deleteProjectOpen)
            setDropdownOpen(true);
        else
            setDropdownOpen(false);
    }, [selectProjectsOpen, createProjectOpen, deleteProjectOpen]);

    return (
        <div className="w-fit gap-2 flex flex-row items-center">
            <BaseDropdown
                context="project"
                button={<ActionButton
                    className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                    tooltip="Manage Projects"
                    icon={<FolderCog />}
                    variant="outline"
                />}
                className="min-w-0 w-fit"
                open={dropdownOpen}
                setOpen={setDropdownOpen}
            >
                <div className="w-fit flex flex-col items-center p-2">
                    <div className="w-full border-b pb-1">
                        <FileDirectory
                            data={projectsData}
                            renamingFunction={projectActions.rename}
                            setterFunction={(proj) => selectProjectCommand(proj)}
                            type="Projects"
                            text="Select Projects"
                            variant="ghost"
                            defaultValue={project || undefined}
                            isAutocompleteOpen={defaultProject ? true : undefined}
                            onOpen={onOpen}
                            loading={listProjectsQuery.isLoading}
                            customOpen={selectProjectsOpen}
                            setCustomOpen={setSelectProjectsOpen}
                        />
                    </div>
                    {projects && <div className="w-full pt-1">
                        <CreateProject 
                            creationFunction={async (name: string) => {
                                if (createProjectCommand == undefined) {
                                    return Promise.resolve({
                                        detail: "Create project command not found"
                                    } as ResponseProps);
                                }
                                return await createProjectCommand(name).then(
                                    (response: ResponseProps) => {
                                        if ("info" in response) {
                                            return response;
                                        }
                                        throw new Error(response.detail);
                                    }
                                );
                            }}
                            createProjectOpen={createProjectOpen}
                            setCreateProjectOpen={setCreateProjectOpen}
                            paths={projects}
                            text="Create Project"
                            variant="ghost"
                        />
                    </div>}
                    {project && <div className="w-full border-b py-1">
                        <CloseProject
                            onClick={() => closeProjectCommand()}
                            variant="ghost"
                            text="Close Project"
                        />
                    </div>}
                    {project && <div className="w-full border-b py-1">
                        <DeleteProjectDialog
                            project={project}
                            deletingFunctions={{
                                project: deleteProjectCommand,
                                logs: deleteProjectLogsCommand,
                                logsAndContexts: deleteProjectLogsAndContextsCommand,
                            }}
                            showDialog={deleteProjectOpen}
                            setShowDialog={setDeleteProjectOpen}
                            onDelete={(option) => {
                                if (option === 'logs' || option === 'logs_and_contexts') {
                                    // For these options, a page refresh is needed to reflect the changes.
                                    window.location.reload();
                                }
                                // For the 'project' option, the useCommand hook handles navigation
                                // by clearing query parameters, which effectively reloads the view.
                            }}
                        />
                    </div>}
                </div>
            </BaseDropdown>
            <AutoComplete
                type={"Projects"}
                items={projects.map((project) => ({ label: project, value: project }))}
                defaultValue={project || undefined}
                isOpen={defaultProject ? true : undefined}
                onSelect={(currentValue: string) => {
                    if (selectProjectCommand == undefined) {
                        return Promise.resolve({
                            detail: "Select projects command not found"
                        } as ResponseProps);
                    }
                    return selectProjectCommand({ path: currentValue });
                }}
                onOpen={onOpen}
                loading={listProjectsQuery.isLoading}
            />
            <ActionButton
                className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                variant="outline"
                icon={tabUIState?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={!project || tabUIState?.pending || tabUIState?.dataPending}
                onClick={async () => {
                    tabUIActions?.setRefreshing(true);
                    
                    // Show overlay
                    setOverlayState({
                        isVisible: true,
                        operation: 'refreshing',
                        status: 'loading',
                    });
                    
                    try {
                        // Add minimum delay to ensure loading state is visible
                        const [refreshResult] = await Promise.all([
                            router.refresh(),
                            new Promise(resolve => setTimeout(resolve, 1000)) // Minimum 1 second delay
                        ]);
                        
                        // Show success in overlay
                        setOverlayState({
                            isVisible: true,
                            operation: 'refreshing',
                            status: 'success',
                        });
                    } catch (error) {
                        console.error("Failed to refresh interface:", error);
                        
                        // Show error in overlay
                        setOverlayState({
                            isVisible: true,
                            operation: 'refreshing',
                            status: 'error',
                        });
                    } finally {
                        tabUIActions?.setRefreshing(false);
                    }
                }}
            />
        </div>
    )
};

export default ProjectButtons;