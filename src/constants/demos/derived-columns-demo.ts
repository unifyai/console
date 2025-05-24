export default {
    gif: "table_derived_column_dark",
    link: "interfaces/tables#derived-columns",
    description: "Derived columns make it possible to create new columns based on existing ones. Again, all general Python syntax is supported.",
    // Granular interface structure
    interface: {
        project_id: "derived-columns-demo",
        name: "interface1",
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
            filters: "length@>@ && 0.5",
            table_tile: {
                table_type: "Data Table",
                column_order: "RowNumbering,Entries/x,Entries/y,Entries/length,Entries/length",
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
            view_tile: {},
        }
    ],
    new_counter: 2,
    derived_columns: {
        project: "derived-columns-demo",
        key: "length",
        equation: "({Table:x} ** 2 + {Table:y} ** 2) ** 0.5",
        referenced_logs: {
            Table: {
                filter_expr: ""
            }
        }
    },
    code: `import unify
import random

unify.activate("derived-columns-demo", overwrite=True)

for _ in range(20):
    unify.log(x=random.random(), y=random.random())
`
}