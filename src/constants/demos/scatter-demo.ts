export default {
    gif: "scatter_dark",
    link: "interfaces/plots#scatter-graphs",
    description: "Scatter graphs can be used to plot two numerical columns against each other.",
    newCounter: 2,
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
        projectId: "scatter-demo",
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
            tableTile: {
                tableType: "Data Table"
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
            plotTile: {
                xAxis: "Table.x",
                yAxis: "Table.y",
                regressionLine: "true"
            }
        }
    ],
}