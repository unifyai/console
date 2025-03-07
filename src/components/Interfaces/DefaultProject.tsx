import { Loader2, Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";
import { defaultItems, defaultLogs, defaultNewCounter } from "@/constants/logs";
import { useState } from "react";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { LogsActions, ProjectsActions, TabActions } from "@/types/evals/grid";

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
    setProjectQueryParam,
    setTabQueryParam,
    projectActions,
    tabActions,
    logsActions
}: {
    setProjectQueryParam: (project: string | null) => void,
    setTabQueryParam: (tab: string | null) => void,
    projectActions: ProjectsActions,
    tabActions: TabActions,
    logsActions: LogsActions
}) => {
    const defaultProject = "Maths Assistant";

    // Access projects getter and setter from the store
    const projects = useStoreContext(state => state.projects);

    const disabled = projects == undefined
    const [pending, setPending] = useState(false);

    return (
        <div className="flex flex-col gap-4 justify-center items-center">
            <div className="mt-4 flex justify-center font-semibold">Please select a project, create a project or get started with the example below</div>
            <div className="relative w-1/2 h-[700px] overflow-y-auto rounded-md border border-1 p-2">
                <div className="absolute z-10 top-3 right-12">
                    <ActionButton
                        icon={pending ? <Loader2 className="animate-spin" /> : <Play />}
                        tooltip={"Run Example"}
                        onClick={() => {
                            if (projects?.includes(defaultProject)) {
                                setProjectQueryParam(defaultProject);
                            } else {
                                setPending(true);
                                projectActions.create(defaultProject).then(() => {
                                    tabActions.create(
                                        "tab1", defaultProject, undefined, defaultItems, defaultNewCounter, true
                                    ).then(() => {
                                        logsActions.create(
                                            defaultProject, defaultLogs.params, defaultLogs.entries
                                        ).then(() => {
                                            setPending(false);
                                            setProjectQueryParam(defaultProject);
                                            setTabQueryParam("tab1");
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
    );
};

export default DefaultProject;
