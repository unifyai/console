export const metrics = ["mean", "count", "sum", "var", "std", "min", "max", "median", "mode"];

export const defaultItems = [
    {
        "i": "Table",
        "x": 0.0,
        "y": 0.0,
        "w": 7.0,
        "h": 8.0,
        "tab": "Table",
        "table_type": "Data Table"
    },
    {
        "i": "View",
        "x": 7.0,
        "y": 0.0,
        "w": 5.0,
        "h": 8.0,
        "tab": "View",
        "table": "Table"
    }
];

export const defaultNewCounter = 2;

export const defaultLogs = {
    project: "maths_assistant",
    params: Array(10).fill({
        system_message: "You are a helpful maths assistant, tasked with adding and subtracting integers."
    }),
    entries: [
        {
            question: "69 - 52",
            response: "69 - 52 equals 17.",
            score: 1.0
        },
        {
            question: "16 - 43",
            response: "16 - 43 equals -27.",
            score: 0.0
        },
        {
            question: "33 - 34",
            response: "33 - 34 equals -1.",
            score: 0.0
        },
        {
            question: "14 - 37",
            response: "14 - 37 equals -23.",
            score: 0.0
        },
        {
            question: "95 - 66",
            response: "95 - 66 equals 29.",
            score: 1.0
        },
        {
            question: "33 - 83",
            response: "33 - 83 equals -50.",
            score: 0.0
        },
        {
            question: "65 + 57",
            response: "65 + 57 = 122",
            score: 1.0
        },
        {
            question: "15 + 78",
            response: "15 + 78 equals 93.",
            score: 1.0
        },
        {
            question: "26 + 84",
            response: "26 + 84 = 110",
            score: 1.0
        },
        {
            question: "87 - 66",
            response: "87 - 66 equals 21.",
            score: 1.0
        }
    ]
}
