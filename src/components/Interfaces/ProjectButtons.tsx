import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import CreateProject from "./Table/Buttons/CreateProject";
import CloseProject from "./Table/Buttons/CloseProject";
import FileDirectory from "../Tree/Directory/FileDirectory";
import DeleteDialog from "../Common/Dialogs/Delete";
import { FileProps } from "@/types/common";
import { InterfaceActions, ProjectsActions } from "@/types/evals/grid";
import ActionButton from "../Common/Buttons/Action";
import { SetStateAction } from "react";

const ProjectButtons = ({
    project,
    projects,
    interfaces,
    data,
    refreshing,
    pending,
    dataPending,
    projectActions,
    interfaceActions,
    setRefreshing,
    setPending,
    setDataPending,
    setInterfaces,
    setProjects,
    setInterface,
    setProject,
}: {
    project: string | null,
    projects: string[] | undefined,
    interfaces: string[],
    data: FileProps[],
    refreshing: boolean,
    pending: boolean,
    dataPending: boolean,
    projectActions: ProjectsActions,
    interfaceActions: InterfaceActions,
    setRefreshing: (value: SetStateAction<boolean>) => void,
    setPending: (value: SetStateAction<boolean>) => void,
    setDataPending: (value: SetStateAction<boolean>) => void,
    setInterfaces: (value: SetStateAction<string[]>) => void,
    setProjects: (value: SetStateAction<string[]>) => void,
    setInterface: (value: string | null) => void,
    setProject: (value: string | null) => void,
}) => {
    const router = useRouter();

    return (
        <div className="w-fit gap-2 flex flex-row items-center px-4">
            <FileDirectory
                data={data}
                renamingFunction={projectActions.rename}
                setterFunction={(proj: FileProps | undefined) => {
                    const newProj = proj ? proj.path : null;
                    setPending(true);
                    setDataPending(true);
                    setInterfaces([]);
                    setInterface(null);
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
                            setPending(true);
                            setDataPending(true);
                            setInterface(null);
                            setInterfaces([]);
                            setProject(null);
                        }}
                    />
                    <DeleteDialog
                        type="project"
                        resource={project}
                        deletingFunction={async (name: string) => {
                            await Promise.all(interfaces.map(interface_ => interfaceActions.delete(
                                interface_, project, true
                            )))
                            await Promise.all(interfaces.map(interface_ => interfaceActions.delete(
                                interface_, project, false
                            )))
                            return await projectActions.delete(name);
                        }}
                        variant="outline"
                        onDelete={() => {
                            setPending(true);
                            setDataPending(true);
                            setInterface(null);
                            setInterfaces([]);
                            setProject(null);
                        }}
                    />
                </div>
            )}
            {projects && <CreateProject creationFunction={projectActions.create} paths={projects} />}
            <ActionButton
                variant="outline"
                icon={refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={pending || dataPending}
                onClick={() => {
                    setRefreshing(true);
                    router.refresh();
                }}
            />
        </div>
    )
};

export default ProjectButtons;
