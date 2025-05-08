export default {
    gif: "scatter_dark",
    link: "interfaces/plots#scatter-graphs",
    description: "Scatter graphs can be used to plot two numerical columns against each other.",
    new_counter: 2,
    code: `import unify
import random

unify.activate("scatter-demo", overwrite=True)

for i in range(10):
    unify.log(
        x=i,
        y=i+random.uniform(-0.25, 0.25)
    )
`,
    // Granular interface structure
    interface: {
        project_id: "scatter-demo",
        name: "interface1",
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
                x_axis: "Table.x",
                y_axis: "Table.y",
                regression_line: "true"
            }
        }
    ],
}