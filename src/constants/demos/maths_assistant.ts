export default {
    gif: "quick_start",
    link: "basics/quickstart",
    description: "Run your first eval ⬇️, and then check out the logs in your first interface 📊",
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
`,
    // Granular interface structure
    interface: {
        project_id: "Maths Assistant",
        name: "Maths Assistant Demo"
    },
    // Tab structure
    tab: {
        name: "tab1",
        visible: true,
        active: true,
        order: 0
    },
    // Tiles structure - matches the OpenAPI schemas
    tiles: [
        {
            name: "Table",
            type: "Table",
            position: {
                x: 0.0,
                y: 0.0,
                width: 7.0,
                height: 8.0
            },
            table_tile: {
                table_type: "Data Table"
            }
        },
        {
            name: "View",
            type: "View",
            position: {
                x: 7.0,
                y: 0.0,
                width: 5.0,
                height: 8.0
            },
            table: "Table",
            view_tile: {}
        }
    ],
    new_counter: 2
}