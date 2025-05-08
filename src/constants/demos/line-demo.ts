export default {
    gif: "line_dark",
    link: "interfaces/plots#line-graphs",
    description: "Line graphs are similar to scatter graphs, but a line is drawn between each from left to right. This makes them especially suitable for plotting time-series data.",
    code: `import unify
import random

unify.activate("line-demo", overwrite=True)

for i in range(10):
    unify.log(
        x=i,
        y=i+random.uniform(-0.25, 0.25)
    )
`,
    // Granular interface structure
    interface: {
        project_id: "line-demo",
        name: "interface1"
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
                width: 6.0,
                height: 8.0
            },
            table_tile: {
                table_type: "Data Table"
            }
        },
        {
            name: "Plot",
            type: "Plot",
            position: {
                x: 7.0,
                y: 0.0,
                width: 6.0,
                height: 8.0
            },
            plot_tile: {
                plot_type: "Line Chart",
                x_axis: "Table.x",
                y_axis: "Table.x"
            }
        }
    ],
    new_counter: 2
}