export default {
  gif: 'table_filter_str_dark',
  link: 'interfaces/tables#filtering',
  description:
    'Filtering enables you to select a subset of the data that you want to view. Each column type has a different set of filter options.',
  code: `from datetime import datetime, timedelta
import random
import unify

unify.activate("filtering-demo", overwrite=True)

num_employees = 20
ages = [
    random.randint(20, 50)
    for _ in range(num_employees)
]
catchphrases = random.choices(
    [
        "hello... friend",
        "hell no",
        "did you ask o3?",
        "will do it tomorrow",
        "ask the intern",
    ],
    k=num_employees,
)
last_logins = [
    (datetime.now() - timedelta(
        days=random.randint(0, 5)
    )).isoformat()
    for _ in range(num_employees)
]
open_task_progress = [
    {
        task: random.random()
        for task in random.sample(
            [
                "add NextJS loader",
                "SQL migration",
                "refactor life",
            ],
            random.randint(0, 3),
        )
    }
    for _ in range(num_employees)
]

for age, catchphrase, last_login, otp in zip(
    ages, catchphrases, last_logins, open_task_progress
):
    unify.log(
        age=age,
        how_10x=random.random()*10,
        catchphrase=catchphrase,
        last_login=last_login,
        open_task_progress=otp,
        will_to_live=random.choice([True, False]),
    )
`,
  // Granular interface structure
  interface: {
    projectId: 'filtering-demo',
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
      filters: 'catchphrase~in~ && "ask"§catchphrase~not in~ && "intern"',
      tableTile: {
        tableType: 'Data Table',
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
