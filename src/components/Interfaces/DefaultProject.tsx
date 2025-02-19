import { Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { InterfaceActions, LogsActions, ProjectsActions, TileProps } from "@/types/evals/grid";
import { defaultLogs } from "@/constants/logs";
import { useState } from "react";

const code = `
\`\`\`python
import unify
from random import randint, choice

# agent
client = unify.Unify("gpt-4o@openai")
client.set_system_message("You are a helpful maths assistant, tasked with adding and subtracting integers.")

# test cases
qs = [f"{randint(0, 100)} {choice(['+', '-'])} {randint(0, 100)}" for i in range(10)]

# evaluator
def evaluate_response(question: str, response: str) -> float:
    correct_answer = eval(question)
    try:
        response_int = int(
            "".join([c for c in response.split(" ")[-1] if c.isdigit()]),
        )
        return float(correct_answer == response_int)
    except ValueError:
        return 0.

# evaluation
def evaluate(q: str):
    response = client.generate(q)
    score = evaluate_response(q, response)
    unify.log(
        question=q,
        response=response,
        score=score
    )

# execute + log evaluation
with unify.Project("maths_assistant"):
    with unify.Params(system_message=client.system_message):
        unify.map(evaluate, qs)
\`\`\`
`;

const DefaultProject = ({ projects, logsActions, projectActions, interfaceActions, setProject, setInterface }: {
    projects: string[] | undefined,
    logsActions: LogsActions,
    projectActions: ProjectsActions,
    interfaceActions: InterfaceActions,
    setProject: (project: string) => void,
    setInterface: (interface_: string) => void
}) => {
    const defaultProject = "maths_assistant";
    const defaultItems = [{
        i: "Tile_0",
        x: 0.0,
        y: 0.0,
        w: 6.0,
        h: 6.0,
        tab: "Table",
        table_type: "Data Table",
    }] as TileProps[];
    const defaultNewCounter = 1;
    const disabled = !projects || projects.includes(defaultProject);
    const [pending, setPending] = useState(false);

    return (
        <div className="flex flex-col gap-4 justify-center items-center">
            <div className="mt-4 flex justify-center font-semibold">Please select a project, create a project or get started with the example below</div>
            <div className="relative w-1/2 h-[700px] overflow-y-auto rounded-md border border-1 p-2">
                <div className="absolute z-10 top-3 right-12">
                    <ActionButton
                        icon={pending ? <Loader2 className="animate-spin" /> : <Play />}
                        tooltip={disabled ? "A project with this name already exists" : "Run Example"}
                        onClick={() => {
                            setPending(true);
                            projectActions.create(defaultProject).then(() => {
                                interfaceActions.create(
                                    "interface_1", defaultProject, undefined, undefined, defaultItems, defaultNewCounter, true
                                ).then(() => {
                                    logsActions.create(
                                        defaultProject, defaultLogs.params, defaultLogs.entries
                                    ).then(() => {
                                        setPending(false);
                                        setProject(defaultProject);
                                        setInterface("interface_1");
                                    });
                                });
                            });
                        }}
                        disabled={disabled}
                    />
                </div>
                <MarkdownRender content={code} noBackground />
            </div>
        </div>
    )
}

export default DefaultProject;
