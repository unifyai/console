export default {
    gif: "line_group_dark",
    link: "basics/quickstart",
    description: "Run your first eval ⬇️, and then check out the logs in your first interface 📊",
    project: "Maths Assistant",
    name: "tab1",
    items: [
        {
            i: "Table",
            x: 0.0,
            y: 0.0,
            w: 7.0,
            h: 8.0,
            tab: "Table",
            table_type: "Data Table"
        },
        {
            i: "View",
            x: 7.0,
            y: 0.0,
            w: 5.0,
            h: 8.0,
            tab: "View",
            table: "Table"
        }
    ],
    new_counter: 2,
    code: `import unify
from random import randint, choice

# initialize project
unify.activate("Maths Assistant", overwrite=True)

# build agent
client = unify.Unify("o3-mini@openai", traced=True)
client.set_system_message(
    "You are a helpful maths assistant, "
    "tasked with adding and subtracting integers."
)

# add test cases
qs = [
    f"{randint(0, 100)} {choice(['+', '-'])} {randint(0, 100)}"
    for i in range(10)
]

# define evaluator
@unify.traced
def evaluate_response(question: str, response: str) -> float:
    correct_answer = eval(question)
    try:
        response_int = int(
            "".join(
                [
                    c for c in response.split(" ")[-1]
                    if c.isdigit()
                ]
            ),
        )
        return float(correct_answer == response_int)
    except ValueError:
        return 0.

# define evaluation
@unify.traced
def evaluate(q: str):
    response = client.copy().generate(q)
    score = evaluate_response(q, response)
    unify.log(
        question=q,
        response=response,
        score=score
    )

# execute + log your evaluation
with unify.Experiment():
    unify.map(evaluate, qs)
`
}