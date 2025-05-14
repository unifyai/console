"use client";

import { Ellipsis, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProject from "./Table/Buttons/CreateProject";
import CloseProject from "./Table/Buttons/CloseProject";
import FileDirectory from "../Tree/Directory/FileDirectory";
import DeleteDialog from "../Common/Dialogs/Delete";
import { FileProps, ResponseProps } from "@/types/common";
import { ProjectsActions, GranularInterfaceActions, GranularTabActions, GranularTileActions } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { useEffect } from "react";
import { useInterface } from "@/contexts/hooks/interface";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTabUI } from "@/contexts/hooks/tab";
import AutoComplete from "../Common/Misc/AutoComplete";
import BaseDropdown from "../Common/Dropdowns/Base";
import { useCommand } from "@/contexts/hooks/commands/useCommand";
import { useListProjectsQuery } from "@/hooks/Query/useProjectsQuery";

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
}) => {
    const router = useRouter();
    
    // State for dialog controls
    const createProjectOpen = useStoreContext((s) => s.createProjectOpen);
    const setCreateProjectOpen = useStoreContext((s) => s.setCreateProjectOpen);
    const deleteProjectOpen = useStoreContext((s) => s.deleteProjectOpen);
    const setDeleteProjectOpen = useStoreContext((s) => s.setDeleteProjectOpen);
    
    // Global states
    const project = projectQueryParam;
    const projects = useStoreContext((s) => s.projects);
    const projectsData = projects.map((p: string) => ({ path: p, type: "file" }));
    const setProjects = useStoreContext((s) => s.setProjects);
    const setProject = setProjectQueryParam;

    // Interface states and actions with granular access
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabIdOrName || "");

    // Use React Query to load projects
    const listProjectsQuery = useListProjectsQuery(projectActions);
    
    // Initialize command hooks with minimal parameters
    const commandHooks = useCommand({
        projectId: project,
        interfaceId,
        tabId: tabIdOrName,
        setProject,
        setTabQueryParam,
        setInterfaceQueryParam,
        projectActions,
        interfaceActions,
        tabActions,
        tileActions,
    });
    
    const { 
        selectProject: selectProjectCommand, 
        createProject: createProjectCommand, 
        closeProject: closeProjectCommand, 
        deleteProject: deleteProjectCommand
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

    // Use combined disabled state from prop and other sources
    const isDisabled = !project || tabUIState?.pending;

    return (
        <div className="w-fit gap-2 flex flex-row items-center px-4">
            <BaseDropdown
                context="project"
                button={<ActionButton
                    tooltip="Manage Projects"
                    icon={<Ellipsis />}
                    variant="outline"
                />}
                className="min-w-0 w-fit"
            >
                <div className="w-fit flex flex-col items-center p-2">
                    <div className="border-b pb-1">
                        <FileDirectory
                            data={projectsData}
                            renamingFunction={projectActions.rename}
                            setterFunction={(proj) => selectProjectCommand(proj)}
                            type="Projects"
                            defaultValue={project || undefined}
                            isAutocompleteOpen={defaultProject ? true : undefined}
                            onOpen={onOpen}
                            loading={listProjectsQuery.isLoading}
                        />
                    </div>
                    {project && <div className="border-b py-1">
                        <CloseProject
                            onClick={() => closeProjectCommand()}
                            variant="ghost"
                        />
                    </div>}
                    {project && <div className="border-b py-1">
                        <DeleteDialog
                            type="project"
                            args={[project]}
                            deletingFunction={async () => {
                                if (!project) {
                                    return Promise.resolve({
                                        detail: "No project selected"
                                    } as unknown as ResponseProps);
                                }
                                return await deleteProjectCommand(project);
                            }}
                            variant="ghost"
                            onDelete={() => {}}
                            customOpen={deleteProjectOpen}
                            setCustomOpen={setDeleteProjectOpen}
                        />
                    </div>}
                    {projects && <div className="pt-1">
                        <CreateProject 
                            creationFunction={async (name: string) => {
                                return await createProjectCommand(name);
                            }}
                            createProjectOpen={createProjectOpen}
                            setCreateProjectOpen={setCreateProjectOpen}
                            paths={projects}
                            text="Create project"
                            variant="ghost"
                        />
                    </div>}
                </div>
            </BaseDropdown>
            <AutoComplete
                type={"Projects"}
                items={projects.map((project) => ({ label: project, value: project }))}
                defaultValue={project || undefined}
                isOpen={defaultProject ? true : undefined}
                onSelect={(currentValue: string) => selectProjectCommand({ path: currentValue, type: "file" })}
                onOpen={onOpen}
                loading={listProjectsQuery.isLoading}
            />
            <ActionButton
                variant="outline"
                icon={tabUIState?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={!project || tabUIState?.pending || tabUIState?.dataPending}
                onClick={() => {
                    tabUIActions?.setRefreshing(true);
                    router.refresh();
                }}
            />
        </div>
    )
};

export default ProjectButtons;
