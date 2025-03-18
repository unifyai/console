import { ChartLine, Eye, Table } from "lucide-react";
import barDemo from "@/constants/demos/bar-demo.json";
import contextDemo from "@/constants/demos/context-demo.json";
import derivedColumnsDemo from "@/constants/demos/derived-columns-demo.json";
import diffsDemo from "@/constants/demos/diffs-demo.json";
import filteringDemo from "@/constants/demos/filtering-demo.json";
import groupingDemo from "@/constants/demos/grouping-demo.json";
import hiddenColumnsDemo from "@/constants/demos/hidden-columns-demo.json";
import histogramDemo from "@/constants/demos/histogram-demo.json";
import lineDemo from "@/constants/demos/line-demo.json";
import lineDemo2 from "@/constants/demos/line-demo2.json";
import lineDemo3 from "@/constants/demos/line-demo3.json";
import markingAssistantDemo from "@/constants/demos/MarkingAssistant.json";
import quickstartDemo from "@/constants/demos/quickstart-demo.json";
import scatterDemo from "@/constants/demos/scatter-demo.json";
import scatterDemo2 from "@/constants/demos/scatter-demo2.json";
import scatterDemo3 from "@/constants/demos/scatter-demo3.json";
import viewPaneDemo from "@/constants/demos/view-pane-demo.json";
import { TileProps } from "@/types/evals/grid";
import { getLogsParameters } from "@/types/evals/logs";

export const metrics = ["mean", "count", "sum", "var", "std", "min", "max", "median", "mode"];

export const defaultItems = [
    {
        "i": "Table",
        "x": 0.0,
        "y": 0.0,
        "w": 7.0,
        "h": 8.0,
        "minW": undefined,
        "minH": undefined,
        "tab": "Table",
        "table_type": "Data Table"
    },
    {
        "i": "View",
        "x": 7.0,
        "y": 0.0,
        "w": 5.0,
        "h": 8.0,
        "minW": undefined,
        "minH": undefined,
        "tab": "View",
        "table": "Table"
    }
];

export const defaultNewCounter = 2;

export const icons = {
    "Table": <Table />,
    "View": <Eye />,
    "Plot": <ChartLine />
};

export const tabTypes = ["Table", "Plot", "View"];

export const demos: {
    [key: string]: {
        project: string,
        name: string,
        items: TileProps[],
        new_counter: number,
        logs: any,
        code: string,
        gif: string,
        link: string,
        description: string,
        derived_columns?: {
            project: string,
            context?: string | undefined,
            key: string,
            equation: string,
            referenced_logs: { [table_name: string]: getLogsParameters },
        },
    }
} = {
    "Basics/Quickstart": {
        ...quickstartDemo,
        gif: "line_group_dark",
        link: "basics/quickstart",
        description: "Run your first eval ⬇️, and then check out the logs in your first interface 📊"
    },
    "Basics/Context": {
        ...contextDemo,
        gif: "table_nested_contexts_dark",
        link: "interfaces/basics#contexts",
        description: "Contexts enable you to compartmentalize your data for different tables or for different tabs within your interface."
    },
    "Tables/Derived Columns": {
        ...derivedColumnsDemo,
        gif: "table_derived_column_dark",
        link: "interfaces/tables#derived-columns",
        description: "Derived columns make it possible to create new columns based on existing ones. Again, all general Python syntax is supported."
    },
    "Tables/Filtering": {
        ...filteringDemo,
        gif: "table_filter_str_dark",
        link: "interfaces/tables#filtering",
        description: "Filtering enables you to select a subset of the data that you want to view. Each column type has a different set of filter options."
    },
    "Tables/Grouping": {
        ...groupingDemo,
        gif: "table_grouping_dark",
        link: "interfaces/tables#grouping",
        description: "Grouping makes it very easy to quickly probe the data across all of your experiments, enabling you to easily transcending the boundaries of rigid “experiments” flexibly."
    },
    "Views/Diffs": {
        ...diffsDemo,
        gif: "string_diffs_dark",
        link: "interfaces/views#diffs",
        description: "The view pane supports very expressive diffs across cells."
    },
    "Views/Hidden Columns": {
        ...hiddenColumnsDemo,
        gif: "view_show_hide_dark",
        link: "interfaces/views#hidden-columns",
        description: "Columns can be hidden by directly clicking the (-) icon which appears on hover, and also via the show / hide selector menu at the top. Column hiding in the view pane is totally independent from hidden columns in the table, making it easy to split the data across the two formats."
    },
    "Views/View Pane": {
        ...viewPaneDemo,
        gif: "view_pair_table_dark",
        link: "interfaces/views",
        description: "The view pane acts as an expressive viewer for whatever cell(s) are selected in the table. These cells can be part of the same row, different rows, different columns, or any combination. In all cases, all of the data will be shown in the view pane."
    },
    "Plots/Bar Plot": {
        ...barDemo,
        gif: "plots_bar_chart_grouping_dark",
        link: "interfaces/plots#bar-charts",
        description: "Bar charts are different to line graphs and scatter graphs. The x axis does not represent individual numerical values, but instead represents groups of data of any type (which share the same value). The y axis then represents a reduction across the data in each group (bar) in the graph."
    },
    "Plots/Histogram": {
        ...histogramDemo,
        gif: "histogram_dark",
        link: "interfaces/plots#histograms",
        description: "Histograms take a single numeric column, and then bucket this data into n bins on the x-axis, and plot the count of data in each bin on the y-axis."
    },
    "Plots/Line Plot/Simple": {
        ...lineDemo,
        gif: "line_dark",
        link: "interfaces/plots#line-graphs",
        description: "Line graphs are similar to scatter graphs, but a line is drawn between each from left to right. This makes them especially suitable for plotting time-series data."
    },
    "Plots/Line Plot/Model Speed": {
        ...lineDemo2,
        gif: "line_group_dark",
        link: "interfaces/plots#line-graphs",
        description: "Plot the speed of different models across time, which are being continually streamed."
    },
    "Plots/Line Plot/Endpoint Speed": {
        ...lineDemo3,
        gif: "line_six_groups_dark",
        link: "interfaces/plots#line-graphs",
        description: "We can create a derived endpoint column to plot a unique line for each model + provider combination."
    },
    "Plots/Scatter Plot/Simple": {
        ...scatterDemo,
        gif: "scatter_dark",
        link: "interfaces/plots#scatter-graphs",
        description: "Scatter graphs can be used to plot two numerical columns against each other."
    },
    "Plots/Scatter Plot/Gender Grouping": {
        ...scatterDemo2,
        gif: "scatter_grouped_dark",
        link: "interfaces/plots#scatter-graphs",
        description: "We can also overlay several plots on the graph, by selecting another column to group by (based on value equality, the same as grouping in the table)."
    },
    "Plots/Scatter Plot/Derived Grouping": {
        ...scatterDemo3,
        gif: "scatter_two_groups_dark",
        link: "interfaces/plots#scatter-graphs",
        description: "If we want to group across multiple independent variables, we can just create a new derived column to express the desired group."
    },
    "Demos/Marking Assistant": {
        ...markingAssistantDemo,
        gif: "demo_set_context_to_usage",
        link: "demo/usage_dashboard",
        description: "Let’s assume our app has been deployed for a few weeks now, and we’ve been tracking the daily usage coming from ~100 active users. For now, the students answer the questions, and then a human marks the questions asynchronously, but this is both timely and expensive."
    } as {
        project: string,
        name: string,
        items: TileProps[],
        new_counter: number,
        logs: any,
        code: string,
        gif: string,
        link: string,
        description: string,
    },
}
