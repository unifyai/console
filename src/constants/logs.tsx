import { ChartLine, Code, Eye, Folder, Plus, Table, Trash, X } from "lucide-react";
import { TileProps } from "@/types/evals/grid";
import { getLogsParameters } from "@/types/evals/logs";
import mathsAssistant from "./demos/maths_assistant";
import contextDemo from "./demos/context-demo";
import derivedColumnsDemo from "./demos/derived-columns-demo";
import filteringDemo from "./demos/filtering-demo";
import groupingDemo from "./demos/grouping-demo";
import diffsDemo from "./demos/diffs-demo";
import hiddenColumnsDemo from "./demos/hidden-columns-demo";
import viewPaneDemo from "./demos/view-pane-demo";
import barDemo from "./demos/bar-demo";
import histogramDemo from "./demos/histogram-demo";
import lineDemo from "./demos/line-demo";
import lineDemo2 from "./demos/line-demo2";
import lineDemo3 from "./demos/line-demo3";
import scatterDemo from "./demos/scatter-demo";
import scatterDemo2 from "./demos/scatter-demo2";
import scatterDemo3 from "./demos/scatter-demo3";
import markingAssistant from "./demos/marking_assistant";

export const metrics = ["mean", "count", "sum", "var", "std", "min", "max", "median", "mode"];

// export const defaultItems = [
//     {
//         "i": "Table",
//         "x": 0.0,
//         "y": 0.0,
//         "w": 7.0,
//         "h": 8.0,
//         "minW": undefined,
//         "minH": undefined,
//         "tab": "Table",
//         "table_type": "Data Table"
//     },
//     {
//         "i": "View",
//         "x": 7.0,
//         "y": 0.0,
//         "w": 5.0,
//         "h": 8.0,
//         "minW": undefined,
//         "minH": undefined,
//         "tab": "View",
//         "table": "Table"
//     }
// ];
export const defaultItems: TileProps[] = [];

// export const defaultNewCounter = 2;
export const defaultNewCounter = 0;

export const icons = {
    "Table": <Table />,
    "View": <Eye />,
    "Plot": <ChartLine />,
    "Editor": <Code />
};

export const tabTypes = ["Table", "Plot", "View", "Editor"];

export const fileTypes: { [key: string]: string } = {
    "py": "python",
    "txt": "text",
    "json": "json",
    "js": "javascript",
    "ts": "typescript",
    "jsx": "javascript",
    "tsx": "typescript",
    "html": "html",
    "css": "css",
    "scss": "scss",
    "md": "markdown",
    "yaml": "yaml",
    "yml": "yaml",
    "xml": "xml",
    "toml": "toml",
    "ini": "ini",
    "conf": "conf",
    "sql": "sql",
    "sh": "bash"
}

export const demos: {
    [key: string]: {
        project: string,
        name: string,
        items: TileProps[],
        new_counter: number,
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
    "Basics/Quickstart": mathsAssistant,
    "Basics/Context": contextDemo,
    "Tables/Derived Columns": derivedColumnsDemo,
    "Tables/Filtering": filteringDemo,
    "Tables/Grouping": groupingDemo,
    "Views/Diffs": diffsDemo,
    "Views/Hidden Columns": hiddenColumnsDemo,
    "Views/View Pane": viewPaneDemo,
    "Plots/Bar Plot": barDemo,
    "Plots/Histogram": histogramDemo,
    "Plots/Line Plot/Simple": lineDemo,
    "Plots/Line Plot/Model Speed": lineDemo2,
    "Plots/Line Plot/Endpoint Speed": lineDemo3,
    "Plots/Scatter Plot/Simple": scatterDemo,
    "Plots/Scatter Plot/Gender Grouping": scatterDemo2,
    "Plots/Scatter Plot/Derived Grouping": scatterDemo3,
    "Case Study/Marking Assistant": markingAssistant,
}

export const iconMap: Record<string, React.ReactNode> = {
    "Plus": <Plus className="mr-2" />,
    "X": <X className="mr-2" />,
    "Trash": <Trash className="mr-2" />,
    "Folder": <Folder className="mr-2" />
};
