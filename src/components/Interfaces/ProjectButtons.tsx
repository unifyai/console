"use client";

import { RefreshCw } from "lucide-react";
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
    const { dataActions: interfaceDataActions } = useInterface(interfaceId);

    const tabNames = interfaceDataActions?.getTabNames() || [];

    // Tab states and actions with granular access
    const { ui: tabUIState, uiActions: tabUIActions } = useTabUI(tabQueryParam || "");

    return (
        <div className="w-fit gap-2 flex flex-row items-center px-4">
            <FileDirectory
                data={projectsData}
                renamingFunction={serverProjectActions.rename}
                setterFunction={(proj: FileProps | undefined) => {
                    const newProj = proj ? proj.path : null;
                    tabUIActions?.setPending(true);
                    tabUIActions?.setDataPending(true);
                    interfaceDataActions?.setTabNames([]);
                    setTabQueryParam(null);
                    setProject(newProj);
                }}
                type="Projects"
                defaultValue={project || undefined}
                isAutocompleteOpen={defaultProject ? true : undefined}
                onOpen={() => {
                    setLoading(true);
                    serverProjectActions.get().then(projects => {
                        setProjects(projects);
                        setLoading(false);
                    });
                }}
                loading={loading}
            />
            {project && (
                <div className="flex flex-row gap-2">
                    <CloseProject
                        onClick={() => {
                            tabUIActions?.setPending(true);
                            tabUIActions?.setDataPending(true);
                            setTabQueryParam(null);
                            interfaceDataActions?.setTabNames([]);
                            setProject(null);
                        }}
                    />
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
                        variant="outline"
                        onDelete={() => {
                            tabUIActions?.setPending(true);
                            tabUIActions?.setDataPending(true);
                            setTabQueryParam(null);
                            interfaceDataActions?.setTabNames([]);
                            setProject(null);
                            serverProjectActions.get().then(projects => setProjects(projects));
                        }}
                    />
                </div>
            )}
            {projects && <CreateProject creationFunction={serverProjectActions.create} paths={projects} />}
            <ActionButton
                variant="outline"
                icon={tabUIState?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={!project ||tabUIState?.pending || tabUIState?.dataPending}
                onClick={() => {
                    tabUIActions?.setRefreshing(true);
                    router.refresh();
                }}
            />
        </div>
    )
};

export default ProjectButtons;
