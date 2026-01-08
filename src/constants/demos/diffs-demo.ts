export default {
  gif: 'string_diffs_dark',
  link: 'interfaces/views#diffs',
  description: 'The view pane supports very expressive diffs across cells.',
  code: `import unify
from datetime import datetime

unify.activate("diffs-demo", overwrite=True)

unify.log(
    x=1,
    y=1.2,
    msg="hello friend",
    flag=True,
    appointment=datetime(2025, 3, 23, 10, 30).isoformat(),
    dct={"a": 1, "b": 2},
    lst=[1, 2, 3],
)
unify.log(
    x=2,
    y=1.2,
    msg="hey buddy",
    flag=True,
    appointment=datetime(2025, 2, 15, 11, 30).isoformat(),
    dct={"b": 2, "c": 3},
    lst=[4, 5, 6],
)
unify.log(
    x=3,
    y=1.3,
    msg="hello partner",
    flag=False,
    appointment=datetime(2025, 4, 11, 12, 30).isoformat(),
    dct={"a": 1, "b": 3, "c": 4},
    lst=[1, 2, 3, 4],
)
`,
  // Granular interface structure
  interface: {
    projectId: 'diffs-demo',
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
      tableTile: {
        tableType: 'Data Table',
        selected: '320993_Entries/msg,320992_Entries/msg,320991_Entries/msg',
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
