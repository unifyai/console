export default {
    gif: "scatter_grouped_dark",
    link: "interfaces/plots#scatter-graphs",
    description: "We can also overlay several plots on the graph, by selecting another column to group by (based on value equality, the same as grouping in the table).",
    code: `import unify
import random

unify.activate("scatter-demo2", overwrite=True)

gender_factors = {"male": 2000, "female": 1000}
for gender in ["male", "female"]:
    for age in range(20, 55):
        age += random.randint(-5, 5)
        unify.log(
            gender=gender,
            age=age,
            salary=(
                age*500 +
                age*gender_factors[gender]*random.random()
            ),
        )
`,
    // Granular interface structure
    interface: {
        projectId: "scatter-demo2",
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
                plotType: "Scatter",
                xAxis: "Table.age",
                yAxis: "Table.salary",
                plotGroupBy: "Table.gender",
                regressionLine: "true"
            }
        }
    ],
    newCounter: 2
}