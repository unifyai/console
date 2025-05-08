export default {
    gif: "scatter_two_groups_dark",
    link: "interfaces/plots#scatter-graphs",
    description: "If we want to group across multiple independent variables, we can just create a new derived column to express the desired group.",
    // Granular interface structure
    interface: {
        project_id: "scatter-demo3",
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
                plot_type: "Scatter",
                x_axis: "Table.age",
                y_axis: "Table.salary",
                plot_group_by: "Table.identity",
                regression_line: "true"
            }
        }
    ],
    new_counter: 2,
    derived_columns: {
        project: "scatter-demo3",
        key: "identity",
        equation: "{Table:gender} + {Table:nationality}",
        referenced_logs: {
            Table: {
                filter_expr: ""
            }
        }
    },
    code: `import unify
import random

unify.activate("scatter-demo3", overwrite=True)

gender_factors = {"male": 1500, "female": 750}
loc_offsets = {"UK": 15000, "US": 45000}
for gender in ["male", "female"]:
    for loc in ["UK", "US"]:
        for age in range(20, 55):
            unify.log(
                gender=gender,
                nationality=loc,
                age=age,
                salary=(
                    age*500 +
                    age*gender_factors[gender]*random.random() +
                    loc_offsets[loc]*random.random()
                ),
            )
`
}