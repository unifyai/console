export default {
  gif: 'line_six_groups_dark',
  link: 'interfaces/plots#line-graphs',
  description:
    'We can create a derived endpoint column to plot a unique line for each model + provider combination.',
  code: `import unify
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
`,
  // Granular interface structure
  interface: {
    projectId: 'line-demo3',
    name: 'interface1',
  },
  // Tab structure
  tab: {
    name: 'tab1',
    visible: true,
    active: true,
    order: 0,
  },
  // Tiles structure - matches the OpenAPI schemas
  tiles: [
    {
      name: 'Table',
      type: 'Table',
      position: {
        x: 0.0,
        y: 0.0,
        width: 6.0,
        height: 8.0,
      },
      tableTile: {
        tableType: 'Data Table',
      },
    },
    {
      name: 'Plot',
      type: 'Plot',
      position: {
        x: 7.0,
        y: 0.0,
        width: 6.0,
        height: 8.0,
      },
      plotTile: {
        plotType: 'Line Chart',
        xAxis: 'Table.time',
        yAxis: 'Table.speed',
        plotGroupBy: 'Table.endpoint',
      },
    },
  ],
  newCounter: 2,
};
