export default {
    gif: "histogram_dark",
    link: "interfaces/plots#histograms",
    description: "Histograms take a single numeric column, and then bucket this data into n bins on the x-axis, and plot the count of data in each bin on the y-axis.",
    project: "histogram-demo",
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
            plot_type: "Histogram",
            x_axis: "Table.date",
            bin_count: "84"
        }
    ],
    new_counter: 2,
    code: `from datetime import date
import random
import unify

unify.activate("histogram-demo", overwrite=True)

n = 10
for month in range(1, 13):
    num_queries = random.randint(month*n, (month+10)*n)
    unify.create_logs(
        entries=[
            {
                "date": date(
                    2025, month, random.randint(1, 28)
                ).isoformat()
            }
            for _ in range(num_queries)
        ]
    )
`
}