export default {
    gif: "line_six_groups_dark",
    link: "interfaces/plots#line-graphs",
    description: "We can create a derived endpoint column to plot a unique line for each model + provider combination.",
    project: "line-demo3",
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
            plot_type: "Line Chart",
            x_axis: "Table.time",
            y_axis: "Table.speed",
            plot_group_by: "Table.endpoint"
        }
    ],
    new_counter: 2,
    code: `
import unify
import random

unify.activate("line-demo3", overwrite=True)

model_speeds = {
    "llama-3.1-8b-chat": 12,
    "llama-3.1-70b-chat": 7,
    "llama-3.1-405b-chat": 4
}
provider_speeds = {
    "fireworks-ai": 10,
    "together-ai": 9,
    "aws-bedrock": 8
}
for i in range(25):
    for model, model_speed in model_speeds.items():
        for provider, provider_speed in provider_speeds.items():
            unify.log(  
                model=model,
                provider=provider,
                time=i,
                speed=(
                    model_speed + 
                    provider_speed + 
                    random.uniform(-2, 2)
                )
            )
`
}