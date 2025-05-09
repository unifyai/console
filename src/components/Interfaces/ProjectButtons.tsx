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
import { defaultTiles, defaultInterface, defaultTab } from "@/constants/logs";
import AutoComplete from "../Common/Misc/AutoComplete";
import BaseDropdown from "../Common/Dropdowns/Base";
import { useCreateProjectQuery } from "@/hooks/Query/useCreateProjectQuery";
import { useListProjectsQuery, useCreateProjectQuery as useCreateSimpleProjectQuery } from "@/hooks/Query/useProjectsQuery";
import { useDeleteInterfaceUnifiedQuery } from "@/hooks/Query/useInterfacesQuery";

const ProjectButtons = ({
    interfaceId,
    tabQueryParam,
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
    interfaceId: string;
    tabQueryParam: string | null;
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
    
    // Initialize React Query hooks
    const createProjectMutation = useCreateProjectQuery();
    const listProjectsQuery = useListProjectsQuery(projectActions);
    const deleteInterfaceMutation = useDeleteInterfaceUnifiedQuery();
    const createSimpleProjectMutation = useCreateSimpleProjectQuery();

    // Global states
    const project = projectQueryParam;
    const projects = useStoreContext((s) => s.projects);
    const projectsData = projects.map((p: string) => ({ path: p, type: "file" }));
    const setProjects = useStoreContext((s) => s.setProjects);
    const setProject = setProjectQueryParam;

    // Interface states and actions with granular access
    const { dataActions: interfaceDataActions } = useInterface(interfaceId);
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabQueryParam || "");

    // Use React Query to load projects instead of direct server call
    useEffect(() => {
        if (listProjectsQuery.data) {
            setProjects(listProjectsQuery.data);
        }
    }, [listProjectsQuery.data, setProjects]);

    const onOpen = () => {
        // Refetch projects using React Query
        listProjectsQuery.refetch();
    }

    const setterFunction = (proj: FileProps | undefined) => {
        const newProj = proj ? proj.path : null;
        tabUIActions?.setPending(true);
        tabUIActions?.setDataPending(true);
        interfaceDataActions?.setTabNames([]);
        setTabQueryParam(null);
        setProject(newProj);
    }
    
    const handleCreateProject = async (name: string) => {
        try {
            // Create a default interface for the new project
            const newInterface = {
                ...defaultInterface,
                project_id: name,
            };
            
            // Use the create project mutation to create interface, tab, and tiles
            const result = await createProjectMutation.mutateAsync({
                interface: newInterface,
                tab: defaultTab,
                tiles: defaultTiles,
                actions: {
                    interfaceActions,
                    tabActions,
                    tileActions
                }
            });
            
            // Update UI state after successful creation
            setProject(name);
            setInterfaceQueryParam("interface1");
            setTabQueryParam("tab1");
            tabUIActions?.setPending(true);
            tabUIActions?.setDataPending(true);
            interfaceDataActions?.setTabNames(["tab1"]);
            
            // Project list will be automatically updated through query invalidation
            
            return result.tab;
        } catch (error) {
            console.error("Error creating project:", error);
            throw error;
        }
    };
    
    const handleDeleteProject = async (name: string) => {
        try {
            // Use the delete interface mutation with React Query
            await deleteInterfaceMutation.mutateAsync({
                params: { projectId: name },
                actions: interfaceActions
            });
            
            // Update UI state after successful deletion
            tabUIActions?.setPending(true);
            tabUIActions?.setDataPending(true);
            setTabQueryParam(null);
            interfaceDataActions?.setTabNames([]);
            setInterfaceQueryParam(null);
            setProject(null);
            
            // Project list will be automatically updated through query invalidation
            
            // Return a response object that matches the expected ResponseProps type
            return { info: "Project deleted successfully" } as unknown as ResponseProps;
        } catch (error) {
            console.error("Error deleting project:", error);
            throw error;
        }
    };

    // Wrapper for CreateProject component to match expected signature
    const createProjectWrapper = (name: string, value: string) => {
        // First create the basic project structure
        return createSimpleProjectMutation.mutateAsync({
            name,
            actions: projectActions
        }).then(async (response) => {
            // Then create the interface, tab, and tiles
            await handleCreateProject(name);
            return response;
        });
    };

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
                            setterFunction={setterFunction}
                            type="Projects"
                            defaultValue={project || undefined}
                            isAutocompleteOpen={defaultProject ? true : undefined}
                            onOpen={onOpen}
                            loading={listProjectsQuery.isLoading}
                        />
                    </div>
                    {project && <div className="border-b py-1">
                        <CloseProject
                            onClick={() => {
                                tabUIActions?.setPending(true);
                                tabUIActions?.setDataPending(true);
                                setTabQueryParam(null);
                                interfaceDataActions?.setTabNames([]);
                                setInterfaceQueryParam(null);
                                setProject(null);
                            }}
                            variant="ghost"
                        />
                    </div>}
                    {project && <div className="border-b py-1">
                        <DeleteDialog
                            type="project"
                            args={[project]}
                            deletingFunction={handleDeleteProject}
                            variant="ghost"
                            onDelete={() => {
                                // UI updates handled in the handleDeleteProject function
                            }}
                        />
                    </div>}
                    {projects && <div className="pt-1">
                        <CreateProject 
                            creationFunction={createProjectWrapper}
                            paths={projects} 
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
                onSelect={(currentValue: string) => setterFunction({ path: currentValue })}
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
