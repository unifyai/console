export default {
    gif: "scatter_dark",
    link: "interfaces/plots#scatter-graphs",
    description: "Scatter graphs can be used to plot two numerical columns against each other.",
    project: "scatter-demo",
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
            x_axis: "Table.x",
            y_axis: "Table.y",
            regression_line: "true"
        }
    ],
    new_counter: 2,
    code: `
import unify
import random

unify.activate("scatter-demo", overwrite=True)

for i in range(10):
    unify.log(
        x=i,
        y=i+random.uniform(-0.25, 0.25)
    )
`
}