import { Play } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import MarkdownRender from "../Common/Code/MarkdownRender";

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
with unify.Project("Maths Assistant"):
    with unify.Params(system_message=client.system_message):
        unify.map(evaluate, qs)
\`\`\`
`;

const DefaultProject = () => {
    return (
        <div className="flex flex-col gap-4 justify-center items-center">
            <div className="mt-4 flex justify-center font-semibold">Please select a project, create a project or get started with the example below</div>
            <div className="relative w-1/2 h-[700px] overflow-y-auto rounded-md">
                <div className="absolute z-10 top-1 right-9">
                    <ActionButton
                        icon={<Play />}
                        tooltip="Run Example"
                        onClick={() => {}}
                    />
                </div>
                <MarkdownRender content={code} />
            </div>
        </div>
    )
}

export default DefaultProject;
