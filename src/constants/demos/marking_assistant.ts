export default {
    gif: "demo_set_context_to_usage",
    link: "case_study/usage_dashboard",
    description: "Let’s assume our app has been deployed for a few weeks now, and we’ve been tracking the daily usage coming from ~100 active users. For now, the students answer the questions, and then a human marks the questions asynchronously, but this is both timely and expensive.",
    project: "MarkingAssistant",
    name: "tab1",
    items: [
        {
            i: "Table",
            x: 0.0,
            y: 0.0,
            w: 7.0,
            h: 8.0,
            tab: "Table",
            table_type: "Data Table",
            context: "Usage"
        }
    ],
    new_counter: 1,
    code: `
import os
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
`
}