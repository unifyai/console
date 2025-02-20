import { ChartLine, Eye, Table } from "lucide-react";

export const metrics = ["mean", "count", "sum", "var", "std", "min", "max", "median", "mode"];

export const defaultItems = [
    {
        "i": "Table",
        "x": 0.0,
        "y": 0.0,
        "w": 7.0,
        "h": 8.0,
        "minW": 4.0,
        "minH": 4.0,
        "tab": "Table",
        "table_type": "Data Table"
    },
    {
        "i": "View",
        "x": 7.0,
        "y": 0.0,
        "w": 5.0,
        "h": 8.0,
        "minW": 4.0,
        "minH": 4.0,
        "tab": "View",
        "table": "Table"
    }
];

export const defaultNewCounter = 2;

export const defaultLogs = {
    project: "maths_assistant",
    params: Array(10).fill({
        experiment: 0
    }),
    entries: [
        {
            "question": "94 - 71",
            "response": "To solve 94 - 71, subtract 71 from 94. This gives 23.\n\nExplanation:\n94 - 71 = 23\n\nThe answer is 23.",
            "score": 1.0
        },
        {
            "question": "76 + 31",
            "response": "76 + 31 equals 107.",
            "score": 1.0
        },
        {
            "question": "78 - 100",
            "response": "78 - 100 equals -22.",
            "score": 0.0
        },
        {
            "question": "17 - 35",
            "response": "17 - 35 = -18\n\nTo explain briefly: starting from 17, subtracting 35 moves you 35 units to the left on the number line, landing at -18.",
            "score": 0.0
        },
        {
            "question": "2 + 91",
            "response": "2 + 91 = 93",
            "score": 1.0
        },
        {
            "question": "60 + 30",
            "response": "60 + 30 = 90",
            "score": 1.0
        },
        {
            "question": "85 - 53",
            "response": "To solve 85 - 53, you can subtract the tens and ones separately:\n\n1. Subtract the tens: 80 - 50 = 30.\n2. Subtract the ones: 5 - 3 = 2.\n3. Add the results: 30 + 2 = 32.\n\nSo, 85 - 53 = 32.",
            "score": 1.0
        },
        {
            "question": "61 + 90",
            "response": "To calculate 61 + 90, you simply add the two numbers together:\n\n61 + 90 = 151\n\nSo, the sum is 151.",
            "score": 1.0
        },
        {
            "question": "86 - 58",
            "response": "86 - 58 = 28",
            "score": 1.0
        },
        {
            "question": "4 - 46",
            "response": "To solve 4 - 46, you subtract 46 from 4. Since 46 is larger than 4, the result is negative. Here's a breakdown:\n\nStep 1: 4 - 46 = -(46 - 4)\nStep 2: 46 - 4 = 42\nStep 3: So, 4 - 46 = -42\n\nTherefore, the answer is -42.",
            "score": 0.0
        }
    ]
}

export const icons = {
    "Table": <Table />,
    "View": <Eye />,
    "Plot": <ChartLine />
};

export const tabTypes = ["Table", "Plot", "View"];
