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
    projectActions: serverProjectActions,
    tabActions: serverTabActions,
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
    const { actions: interfaceActions } = useInterface(interfaceId);

    const tabIds = interfaceActions?.getTabIds() || [];

    // Tab states and actions
    const { tab: tabData, actions: tabActions } = useTab(tabQueryParam || "");

    return (
        <div className="w-fit gap-2 flex flex-row items-center px-4">
            <FileDirectory
                data={projectsData}
                renamingFunction={serverProjectActions.rename}
                setterFunction={(proj: FileProps | undefined) => {
                    const newProj = proj ? proj.path : null;
                    tabActions?.setPending(true);
                    tabActions?.setDataPending(true);
                    interfaceActions?.setTabIds([]);
                    setTabQueryParam(null);
                    setProject(newProj);
                }}
                type="Projects"
                defaultValue={project || undefined}
                onOpen={() => serverProjectActions.get().then(projects => setProjects(projects))}
            />
            {project && (
                <div className="flex flex-row gap-2">
                    <CloseProject
                        onClick={() => {
                            tabActions?.setPending(true);
                            tabActions?.setDataPending(true);
                            setTabQueryParam(null);
                            interfaceActions?.setTabIds([]);
                            setProject(null);
                        }}
                    />
                    <DeleteDialog
                        type="project"
                        args={[project]}
                        deletingFunction={async (name: string) => {
                            await Promise.all(tabIds.map(tabId => serverTabActions.delete(
                                tabId, project, true
                            )))
                            await Promise.all(tabIds.map(tabId => serverTabActions.delete(
                                tabId, project, false
                            )))
                            return await serverProjectActions.delete(name);
                        }}
                        variant="outline"
                        onDelete={() => {
                            tabActions?.setPending(true);
                            tabActions?.setDataPending(true);
                            setTabQueryParam(null);
                            interfaceActions?.setTabIds([]);
                            setProject(null);
                            serverProjectActions.get().then(projects => setProjects(projects));
                        }}
                    />
                </div>
            )}
            {projects && <CreateProject creationFunction={serverProjectActions.create} paths={projects} />}
            <ActionButton
                variant="outline"
                icon={tabData?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={tabData?.pending || tabData?.dataPending}
                onClick={() => {
                    tabActions?.setRefreshing(true);
                    router.refresh();
                }}
            />
        </div>
    )
};

export default ProjectButtons;
