export default {
    gif: "table_derived_column_dark",
    link: "interfaces/tables#derived-columns",
    description: "Derived columns make it possible to create new columns based on existing ones. Again, all general Python syntax is supported.",
    project: "derived-columns-demo",
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
            column_order: "RowNumbering,Entries/x,Entries/y,Entries/length,Entries/length",
            filters: "length@>@ && 0.5"
        },
        {
            i: "View",
            x: 7.0,
            y: 0.0,
            w: 5.0,
            h: 8.0,
            tab: "View",
            table: "Table"
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