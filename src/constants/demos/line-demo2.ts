export default {
    gif: "line_group_dark",
    link: "interfaces/plots#line-graphs",
    description: "Plot the speed of different models across time, which are being continually streamed.",
    project: "line-demo2",
    name: "tab1",
    items: [
        {
            i: "Table",
            x: 0.0,
            y: 0.0,
            w: 6.0,
            h: 8.0,
            tab: "Table",
            table_type: "Data Table"
        },
        {
            i: "Plot",
            x: 7.0,
            y: 0.0,
            w: 6.0,
            h: 8.0,
            tab: "Plot",
            plot_type: "Line Chart",
            x_axis: "Table.time",
            y_axis: "Table.speed",
            plot_group_by: "Table.model"
        }
    ],
    new_counter: 2,
    code: `
import unify
import random
from datetime import datetime

unify.activate("line-demo2", overwrite=True)

model_speeds = {
    "llama-3.1-8b-chat": 12,
    "llama-3.1-70b-chat": 7,
    "llama-3.1-405b-chat": 4
}
for i in range(10):
    for model, speed in model_speeds.items():
        unify.log(
            model=model,
            time=datetime.now().isoformat(),
            speed=speed+random.uniform(-3, 3)
        )
`
}