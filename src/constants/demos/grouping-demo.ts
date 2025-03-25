export default {
    gif: "table_grouping_dark",
    link: "interfaces/tables#grouping",
    description: "Grouping makes it very easy to quickly probe the data across all of your experiments, enabling you to easily transcending the boundaries of rigid “experiments” flexibly.",
    project: "grouping-demo",
    name: "tab1",
    items: [
        {
            i: "Table",
            x: 0.0,
            y: 0.0,
            w: 7.0,
            h: 8.0,
            tab: "Table",
            table_type: "Data Table",
            grouping: "Parameters/experiment",
            sorting: "score@true"
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
    code: `
import unify
import random

unify.activate("grouping-demo", overwrite=True)

questions = [
    "What is the weather in Paris?",
    "What is the weather in Tokyo?",
    "What is the weather in London?",
]

sys_msgs = [
    "You are a helpful assistant",
    "You are a helpful weather assistant",
    "You are a helpful assistant that can use tools",
]


for with_tool in [True, False]:
    for sys_msg in sys_msgs:
        with unify.Experiment(), unify.Params(
            with_tool=with_tool,
            sys_msg=sys_msg,
        ):
            for i, question in enumerate(questions):
                unify.log(
                    question=question,
                    score=i*0.25 +random.random()/2
                )
`
}