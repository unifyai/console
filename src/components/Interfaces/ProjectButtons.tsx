"use client";

import { Ellipsis, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProject from "./Table/Buttons/CreateProject";
import CloseProject from "./Table/Buttons/CloseProject";
import FileDirectory from "../Tree/Directory/FileDirectory";
import DeleteDialog from "../Common/Dialogs/Delete";
import { FileProps, ResponseProps } from "@/types/common";
import { TabActions, ProjectsActions } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { useState, useEffect } from "react";
import { useInterface } from "@/contexts/hooks/interface";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTabUI } from "@/contexts/hooks/tab";
import AutoComplete from "../Common/Misc/AutoComplete";
import BaseDropdown from "../Common/Dropdowns/Base";

const ProjectButtons = ({
    interfaceId,
    tabQueryParam,
    projectQueryParam,
    defaultProject,
    setProjectQueryParam,
    setTabQueryParam,
    projectActions: serverProjectActions,
    tabActions: serverTabActions,
}: {
    interfaceId: string;
    tabQueryParam: string | null;
    projectQueryParam: string | null;
    defaultProject: boolean,
    setProjectQueryParam: (project: string | null) => void;
    setTabQueryParam: (tab: string | null) => void;
    projectActions: ProjectsActions;
    tabActions: TabActions;
}) => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    // Global states
    const project = projectQueryParam;
    const projects = useStoreContext((s) => s.projects);
    const projectsData = projects.map((p: string) => ({ path: p, type: "file" }));
    const setProjects = useStoreContext((s) => s.setProjects);
    const setProject = setProjectQueryParam;

    // Get commands from store
    const storeCommands = useStoreContext((s) => s.commands);
    const updateCommands = useStoreContext((s) => s.updateCommands);

    // Interface states and actions with granular access
    const { ui: interfaceUIState, uiActions: interfaceUIActions, dataActions: interfaceDataActions } = useInterface(interfaceId);
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabQueryParam || "");

    const tabNames = interfaceDataActions?.getTabNames() || [];

    // Update commands only once when component mounts
    useEffect(() => {
        if (storeCommands.length === 0) {
            updateCommands(
                serverProjectActions,
                serverTabActions,
                project,
                tabNames,
                setProject,
                setTabQueryParam,
                interfaceUIActions,
                interfaceDataActions,
                projects,
                setProjects
            );
        }
    }, [tabNames, project]); // Empty dependency array since we only want to run this once

    const onOpen = () => {
        setLoading(true);
        serverProjectActions.get().then(projects => {
            setProjects(projects);
            setLoading(false);
        });
    }

    const setterFunction = (proj: FileProps | undefined) => {
        const newProj = proj ? proj.path : null;
        interfaceUIActions?.setPending(true);
        interfaceUIActions?.setDataPending(true);
        interfaceDataActions?.setTabNames([]);
        setTabQueryParam(null);
        setProject(newProj);
    }

    // Find the relevant commands
    const createProjectCommand = storeCommands.find(cmd => cmd.id === 'create-project');
    const closeProjectCommand = storeCommands.find(cmd => cmd.id === 'close-project');
    const deleteProjectCommand = storeCommands.find(cmd => cmd.id === 'delete-project');

    const selectProjectsOpen = useStoreContext((s) => s.selectProjectsOpen);
    const createProjectOpen = useStoreContext((s) => s.createProjectOpen);
    const deleteProjectOpen = useStoreContext((s) => s.deleteProjectOpen);
    const setSelectProjectsOpen = useStoreContext((s) => s.setSelectProjectsOpen);
    const setCreateProjectOpen = useStoreContext((s) => s.setCreateProjectOpen);
    const setDeleteProjectOpen = useStoreContext((s) => s.setDeleteProjectOpen);

    // Set dropdown open when deleteProjectOpen is true
    useEffect(() => {
        if (selectProjectsOpen || createProjectOpen || deleteProjectOpen)
            setDropdownOpen(true);
        else
            setDropdownOpen(false);
    }, [selectProjectsOpen, createProjectOpen, deleteProjectOpen]);

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
                open={dropdownOpen}
                setOpen={setDropdownOpen}
            >
                <div className="w-fit flex flex-col items-center p-2">
                    <div className="w-full border-b pb-1">
                        <FileDirectory
                            data={projectsData}
                            renamingFunction={serverProjectActions.rename}
                            setterFunction={setterFunction}
                            type="Projects"
                            text="Select projects"
                            variant="ghost"
                            defaultValue={project || undefined}
                            isAutocompleteOpen={defaultProject ? true : undefined}
                            onOpen={onOpen}
                            loading={loading}
                            customOpen={selectProjectsOpen}
                            setCustomOpen={setSelectProjectsOpen}
                        />
                    </div>
                    {project && <div className="w-full border-b py-1">
                        <CloseProject
                            onClick={() => closeProjectCommand?.action()}
                            variant="ghost"
                            text="Close project"
                        />
                    </div>}
                    {project && <div className="w-full border-b py-1">
                        <DeleteDialog
                            type="project"
                            args={[project]}
                            deletingFunction={async () => {
                                if (deleteProjectCommand == undefined) {
                                    return Promise.resolve({
                                        detail: "Delete project command not found"
                                    } as ResponseProps);
                                }
                                return await deleteProjectCommand?.action();
                            }}
                            variant="ghost"
                            text="Delete project"
                            onDelete={deleteProjectCommand?.onAction}
                            customOpen={deleteProjectOpen}
                            setCustomOpen={setDeleteProjectOpen}
                        />
                    </div>}
                    {projects && <div className="w-full pt-1">
                        <CreateProject
                            creationFunction={(name: string) => {
                                if (createProjectCommand == undefined) {
                                    return Promise.resolve({
                                        detail: "Create project command not found"
                                    } as ResponseProps);
                                }
                                return createProjectCommand.action(name);
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
                onSelect={(currentValue: string) => setterFunction({ path: currentValue })}
                onOpen={onOpen}
                loading={loading}
            />
            <ActionButton
                variant="outline"
                icon={tabUIState?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={!project || interfaceUIState?.pending || interfaceUIState?.dataPending}
                onClick={() => {
                    tabUIActions?.setRefreshing(true);
                    router.refresh();
                }}
            />
        </div>
    )
};

export default ProjectButtons;
