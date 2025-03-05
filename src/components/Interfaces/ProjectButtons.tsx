import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProject from "./Table/Buttons/CreateProject";
import CloseProject from "./Table/Buttons/CloseProject";
import FileDirectory from "../Tree/Directory/FileDirectory";
import DeleteDialog from "../Common/Dialogs/Delete";
import { FileProps } from "@/types/common";
import { TabActions, ProjectsActions } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { useInterface } from "@/contexts/hooks/useInterface";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useTab } from "@/contexts/hooks/useTab";

const ProjectButtons = ({
    interfaceId,
    tabQueryParam,
    projectQueryParam,
    setProjectQueryParam,
    setTabQueryParam,
    projectActions,
    tabActions,
}: {
    interfaceId: string;
    tabQueryParam: string | null;
    projectQueryParam: string | null;
    setProjectQueryParam: (project: string | null) => void;
    setTabQueryParam: (tab: string | null) => void;
    projectActions: ProjectsActions;
    tabActions: TabActions;
}) => {
    const router = useRouter();

    // Global states
    const project = projectQueryParam;
    const projects = useStoreContext((s) => s.projects);
    const projectsData = projects.map((p: string) => ({ path: p, type: "file" }));
    const setProjects = useStoreContext((s) => s.setProjects);
    const setProject = setProjectQueryParam;

    // Interface states and actions
    const { interface: data, actions, exists } = useInterface(interfaceId);

    if (!exists) return null;

    const tabs = data?.tabs ? Object.keys(data.tabs) : [];
    const setTabs = actions?.setTabs!;

    // Tab states and actions
    const { tab: tabData, actions: tabStateActions } = useTab(tabQueryParam || "");

    return (
        <div className="w-fit gap-2 flex flex-row items-center px-4">
            <FileDirectory
                data={projectsData}
                renamingFunction={projectActions.rename}
                setterFunction={(proj: FileProps | undefined) => {
                    const newProj = proj ? proj.path : null;
                    tabStateActions?.setPending(true);
                    tabStateActions?.setDataPending(true);
                    setTabs([]);
                    setTabQueryParam(null);
                    setProject(newProj);
                }}
                type="Projects"
                defaultValue={project || undefined}
                onOpen={() => projectActions.get().then(projects => setProjects(projects))}
            />
            {project && (
                <div className="flex flex-row gap-2">
                    <CloseProject
                        onClick={() => {
                            tabStateActions?.setPending(true);
                            tabStateActions?.setDataPending(true);
                            setTabQueryParam(null);
                            setTabs([]);
                            setProject(null);
                        }}
                    />
                    <DeleteDialog
                        type="project"
                        args={[project]}
                        deletingFunction={async (name: string) => {
                            await Promise.all(tabs.map(tabId => tabActions.delete(
                                tabId, project, true
                            )))
                            await Promise.all(tabs.map(tabId => tabActions.delete(
                                tabId, project, false
                            )))
                            return await projectActions.delete(name);
                        }}
                        variant="outline"
                        onDelete={() => {
                            tabStateActions?.setPending(true);
                            tabStateActions?.setDataPending(true);
                            setTabQueryParam(null);
                            setTabs([]);
                            setProject(null);
                            projectActions.get().then(projects => setProjects(projects));
                        }}
                    />
                </div>
            )}
            {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
            <ActionButton
                variant="outline"
                icon={tabData?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={tabData?.pending || tabData?.dataPending}
                onClick={() => {
                    tabStateActions?.setRefreshing(true);
                    router.refresh();
                }}
            />
        </div>
    )
};

export default ProjectButtons;
