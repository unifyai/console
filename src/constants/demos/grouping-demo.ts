const groupingDemo = {
  gif: 'table_grouping_dark',
  link: 'interfaces/tables#grouping',
  description:
    'Grouping makes it very easy to quickly probe the data across all of your experiments, enabling you to easily transcending the boundaries of rigid “experiments” flexibly.',
  code: `import unify
import random

unify.activate("grouping-demo", overwrite=True)

questions = [
    "What is the weather in Paris?",
    "What is the weather in Tokyo?",
    "What is the weather in London?",
]

sys_msgs = [
    "You are a helpful assistant",
    "You are a helpful weather assistant",
    "You are a helpful assistant that can use tools",
]


for with_tool in [True, False]:
    for sys_msg in sys_msgs:
        with unify.Experiment(), unify.Params(
            with_tool=with_tool,
            sys_msg=sys_msg,
        ):
            for i, question in enumerate(questions):
                unify.log(
                    question=question,
                    score=i*0.25 +random.random()/2
                )
`,
  // Granular interface structure
  interface: {
    projectId: 'grouping-demo',
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
        width: 7.0,
        height: 8.0,
      },
      grouping: 'Parameters/experiment',
      tableTile: {
        tableType: 'Data Table',
        sorting: 'score@true',
      },
    },
    {
      name: 'View',
      type: 'View',
      position: {
        x: 7.0,
        y: 0.0,
        width: 5.0,
        height: 8.0,
      },
      table: 'Table',
      viewTile: {},
    },
  ],
  newCounter: 2,
};

export default groupingDemo;
