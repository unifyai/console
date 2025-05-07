export default {
    gif: "plots_bar_chart_grouping_dark",
    link: "interfaces/plots#bar-charts",
    description: "Bar charts are different to line graphs and scatter graphs. The x axis does not represent individual numerical values, but instead represents groups of data of any type (which share the same value). The y axis then represents a reduction across the data in each group (bar) in the graph.",
    // Granular interface structure
    interface: {
        project_id: "bar-demo",
        name: "Bar Chart Demo",
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
                width: 7.0,
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
                width: 5.0,
                height: 8.0
            },
            metric: "mean",
            plot_tile: {
                plot_type: "Bar Chart",
                x_axis: "Table.experiment",
                y_axis: "Table.score",
            }
        }
    ],
    new_counter: 2,
    derived_columns: {
        project: "bar-demo",
        key: "experiment",
        equation: "\"tool_use:\" + str( {Table:tool_use} ) + \",sys_msg:\" + str(version( {Table:sys_msg} ))",
        referenced_logs: {
            Table: {
                filter_expr: ""
            }
        }
    },
    code: `import unify
import random

unify.activate("bar-demo", overwrite=True)

base_msg = "You are a helpful assistant."
for tool_use in [True, False]:
    with unify.Params(tool_use=tool_use):
        for sys_msg in [
            base_msg,
            base_msg + " You can use tools.",
            base_msg + " You can use tools and search the web."
        ]:
            with unify.Params(sys_msg=sys_msg):  
                for example_idx in range(10):
                    unify.log(
                        example_idx=example_idx,
                        score=random.uniform(0, 10)
                    )
`
}