export default {
    gif: "table_nested_contexts_dark",
    link: "interfaces/basics#contexts",
    description: "Contexts enable you to compartmentalize your data for different tables or for different tabs within your interface.",
    project: "context-demo",
    name: "tab1",
    items: [
        {
            i: "Tile_0",
            x: 0,
            y: 0,
            w: 4,
            h: 8,
            tab: "Table",
            table_type: "Data Table",
            context: "Sciences/Maths",
            column_context: ""
        },
        {
            i: "Tile_1",
            x: 4,
            y: 0,
            w: 4,
            h: 8,
            tab: "Table",
            table_type: "Data Table",
            context: "Sciences/Physics",
            column_context: ""
        },
        {
            i: "Tile_2",
            x: 8,
            y: 0,
            w: 4,
            h: 8,
            tab: "Table",
            table_type: "Data Table",
            context: "Arts/Literature",
            column_context: ""
        }
    ],
    new_counter: 3,
    code: `import unify

unify.activate("context-demo", overwrite=True)

with unify.Context("Sciences"):
    with unify.Context("Maths"):
        unify.log(
            name="Zoe",
            question="what is 1 + 1?",
            region="US"
        )
    with unify.Context("Physics"):
        unify.log(
            name="John",
            question="what is the speed of light?",
            region="EU"
        )
with unify.Context("Arts"):
    with unify.Context("Literature"):
        unify.log(
            name="Jane",
            question="What does this sentence convey?",
            region="UK"
        )
`
}