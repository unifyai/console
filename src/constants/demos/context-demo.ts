export default {
    gif: "table_nested_contexts_dark",
    link: "interfaces/basics#contexts",
    description: "Contexts enable you to compartmentalize your data for different tables or for different tabs within your interface.",
    // Granular interface structure
    interface: {
        project_id: "context-demo",
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
            name: "Tile_0",
            type: "Table",
            position: {
                x: 0.0,
                y: 0.0,
                width: 4.0,
                height: 8.0
            },
            context: "Sciences/Maths",
            column_context: "",
            table_tile: {
                table_type: "Data Table",
            }
        },
        {
            name: "Tile_1",
            type: "Table",
            position: {
                x: 4.0,
                y: 0.0,
                width: 4.0,
                height: 8.0
            },
            context: "Sciences/Physics",
            column_context: "",
            table_tile: {
                table_type: "Data Table",
            }
        },
        {
            name: "Tile_2",
            type: "Table",
            position: {
                x: 8.0,
                y: 0.0,
                width: 4.0,
                height: 8.0
            },
            context: "Arts/Literature",
            column_context: "",
            table_tile: {
                table_type: "Data Table",
            }
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