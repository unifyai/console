export default {
    gif: "scatter_grouped_dark",
    link: "interfaces/plots#scatter-graphs",
    description: "We can also overlay several plots on the graph, by selecting another column to group by (based on value equality, the same as grouping in the table).",
    project: "scatter-demo2",
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
            x_axis: "Table.age",
            y_axis: "Table.salary",
            plot_group_by: "Table.gender",
            regression_line: "true"
        }
    ],
    new_counter: 2,
    code: `
import unify
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
`
}