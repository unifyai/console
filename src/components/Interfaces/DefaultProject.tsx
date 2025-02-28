import { Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { InterfaceActions, LogsActions, ProjectsActions } from "@/types/evals/grid";
import { defaultItems, defaultLogs, defaultNewCounter } from "@/constants/logs";
import { Dispatch, SetStateAction, useState } from "react";
import FileDirectory from "../Tree/Directory/FileDirectory";
import { FileProps } from "@/types/common";
import ProjectButtons from "./ProjectButtons";

const code = `
\`\`\`python
import unify
from random import randint, choice

# initialize project
unify.activate("Maths Assistant")

# build agent
client = unify.Unify("o3-mini@openai", traced=True)
client.set_system_message("You are a helpful maths assistant, tasked with adding and subtracting integers.")

# add test cases
qs = [f"{randint(0, 100)} {choice(['+', '-'])} {randint(0, 100)}" for i in range(10)]

# define evaluator
@unify.traced
def evaluate_response(question: str, response: str) -> float:
    correct_answer = eval(question)
    try:
        response_int = int(
            "".join([c for c in response.split(" ")[-1] if c.isdigit()]),
        )
        return float(correct_answer == response_int)
    except ValueError:
        return 0.

# define evaluation
@unify.traced
def evaluate(q: str):
    response = client.generate(q)
    score = evaluate_response(q, response)
    unify.log(
        question=q,
        response=response,
        score=score
    )

# execute + log your evaluation
with unify.Experiment():
    unify.map(evaluate, qs)
\`\`\`
`;

const DefaultProject = ({
    project,
    projects,
    interfaces,
    data,
    refreshing,
    pending,
    dataPending,
    projectActions,
    interfaceActions,
    logsActions,
    setRefreshing,
    setPending,
    setDataPending,
    setInterfaces,
    setProjects,
    setInterface,
    setProject
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
    logsActions: LogsActions,
    setRefreshing: (value: SetStateAction<boolean>) => void,
    setPending: (value: SetStateAction<boolean>) => void,
    setDataPending: (value: SetStateAction<boolean>) => void,
    setInterfaces: (value: SetStateAction<string[]>) => void,
    setProjects: (value: SetStateAction<string[]>) => void,
    setInterface: (value: string | null) => void,
    setProject: (value: string | null) => void,
}) => {
    const defaultProject = "Maths Assistant";
    const disabled = projects == undefined
    const [pendingLocal, setPendingLocal] = useState(false);

    return projects == undefined || projects.length == 0 || (projects.length == 1 && projects[0] == defaultProject) ? (
        <div className="flex flex-col gap-4 justify-center items-center">
            <div className="mt-4 flex justify-center font-semibold">Please select a project, create a project or get started with the example below</div>
            <div className="relative w-1/2 h-[700px] overflow-y-auto rounded-md border border-1 p-2">
                <div className="absolute z-10 top-3 right-12">
                    <ActionButton
                        icon={pendingLocal ? <Loader2 className="animate-spin" /> : <Play />}
                        tooltip={"Run Example"}
                        onClick={() => {
                            if (projects?.includes(defaultProject)) {
                                setProject(defaultProject);
                            } else {
                                setPendingLocal(true);
                                projectActions.create(defaultProject).then(() => {
                                    interfaceActions.create(
                                        "tab1", defaultProject, undefined, defaultItems, defaultNewCounter, true
                                    ).then(() => {
                                        logsActions.create(
                                            defaultProject, defaultLogs.params, defaultLogs.entries
                                        ).then(() => {
                                            setPendingLocal(false);
                                            setProject(defaultProject);
                                            setInterface("tab1");
                                        });
                                    });
                                });
                            }
                        }}
                        disabled={disabled}
                    />
                </div>
                <MarkdownRender content={code} noBackground />
            </div>
        </div>
    ) : <div className="flex flex-col gap-4 justify-center items-center">
        <div className="mt-4 flex justify-center font-semibold">Please select a project</div>
        <div className="flex justify-center items-center">
            <ProjectButtons
                defaultProject={true}
                project={project}
                projects={projects}
                interfaces={interfaces}
                data={data}
                refreshing={refreshing}
                pending={pending}
                dataPending={dataPending}
                projectActions={projectActions}
                interfaceActions={interfaceActions}
                setRefreshing={setRefreshing}
                setPending={setPending}
                setDataPending={setDataPending}
                setInterfaces={setInterfaces}
                setProjects={setProjects}
                setInterface={setInterface}
                setProject={setProject}
            />
        </div>
    </div>;
}

export default DefaultProject;
