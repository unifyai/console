export default {
    gif: "demo_set_context_to_usage",
    link: "case_study/usage_dashboard",
    description: "Let’s assume our app has been deployed for a few weeks now, and we’ve been tracking the daily usage coming from ~100 active users. For now, the students answer the questions, and then a human marks the questions asynchronously, but this is both timely and expensive.",
    code: `import os
import json
import wget
import unify

unify.activate("MarkingAssistant", overwrite=True)

unify.set_context("Usage")

if not os.path.exists("usage_data.json"):
    wget.download(
        "https://github.com/unifyai/demos/"
        "raw/refs/heads/main/marking_assistant/"
        "data/usage_data.json"
    )

with open("usage_data.json", "r") as f:
    usage_data = json.load(f)

unify.create_logs(entries=usage_data)
`,
    // Granular interface structure
    interface: {
        project_id: "MarkingAssistant",
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
                width: 7.0,
                height: 8.0
            },
            context: "Usage",
            table_tile: {
                table_type: "Data Table"
            }
        },
        {
            name: "View",
            type: "View",
            position: {
                x: 7.0,
                y: 0.0,
                width: 5.0,
                height: 8.0
            },
            table: "Table",
            view_tile: {}
        }
    ],
    new_counter: 1
}