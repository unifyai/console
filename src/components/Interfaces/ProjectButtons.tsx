"use client";

import { Ellipsis, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProject from "./Table/Buttons/CreateProject";
import CloseProject from "./Table/Buttons/CloseProject";
import FileDirectory from "../Tree/Directory/FileDirectory";
import DeleteDialog from "../Common/Dialogs/Delete";
import { FileProps } from "@/types/common";
import { TabActions, ProjectsActions } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { useState } from "react";
import { useInterface } from "@/contexts/hooks/interface";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTabUI } from "@/contexts/hooks/tab";
import { defaultItems, defaultNewCounter } from "@/constants/logs";
import AutoComplete from "../Common/Misc/AutoComplete";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";

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

    // Global states
    const project = projectQueryParam;
    const projects = useStoreContext((s) => s.projects);
    const projectsData = projects.map((p: string) => ({ path: p, type: "file" }));
    const setProjects = useStoreContext((s) => s.setProjects);
    const setProject = setProjectQueryParam;

    // Interface states and actions with granular access
    const { ui: interfaceUIState, uiActions: interfaceUIActions, dataActions: interfaceDataActions } = useInterface(interfaceId);
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabQueryParam || "");

    const tabNames = interfaceDataActions?.getTabNames() || [];

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
                        />
                    </div>
                    {project && <div className="w-full border-b py-1">
                        <CloseProject
                            onClick={() => {
                                interfaceUIActions?.setPending(true);
                                interfaceUIActions?.setDataPending(true);
                                setTabQueryParam(null);
                                interfaceDataActions?.setTabNames([]);
                                setProject(null);
                            }}
                            variant="ghost"
                            text="Close project"
                        />
                    </div>}
                    {project && <div className="w-full border-b py-1">
                        <DeleteDialog
                            type="project"
                            args={[project]}
                            deletingFunction={async (name: string) => {
                                await Promise.all(tabNames.map(tabName => serverTabActions.delete(
                                    tabName, project, true
                                )))
                                await Promise.all(tabNames.map(tabName => serverTabActions.delete(
                                    tabName, project, false
                                )))
                                return await serverProjectActions.delete(name);
                            }}
                            variant="ghost"
                            text="Delete project"
                            onDelete={() => {
                                interfaceUIActions?.setPending(true);
                                interfaceUIActions?.setDataPending(true);
                                setTabQueryParam(null);
                                interfaceDataActions?.setTabNames([]);
                                setProject(null);
                                serverProjectActions.get().then(projects => setProjects(projects));
                            }}
                        />
                    </div>}
                    {projects && <div className="w-full pt-1">
                        <CreateProject creationFunction={(name: string) => {
                            const createProject = serverProjectActions.create(name).then(async () => {
                                await serverTabActions.create(
                                    "tab1", name, undefined, defaultItems, defaultNewCounter, true, undefined
                                );
                                const tabCreate = await serverTabActions.create(
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
                            return createProject;
                        }} paths={projects} text="Create project" variant="ghost" />
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
