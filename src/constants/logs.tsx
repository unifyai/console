import { ChartLine, Code, Eye, Table } from "lucide-react";
import { InterfaceData, TabData, TileData } from "@/types/evals/grid";
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

// export const defaultNewCounter = 2;
export const defaultNewCounter = 0;

// Default interface and tab templates for new projects
export const defaultInterface: InterfaceData = {
  name: "Default Interface",
};

export const defaultTab: TabData = {
  name: "tab1",
  visible: true,
  active: true,
  order: 0,
};

export const defaultTiles: TileData[] = [];

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
        // New granular interface structure
        interface?: InterfaceData;
        tab?: TabData;
        tiles?: TileData[];
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
