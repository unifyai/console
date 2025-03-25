export default {
    gif: "view_pair_table_dark",
    link: "interfaces/views",
    description: "The view pane acts as an expressive viewer for whatever cell(s) are selected in the table. These cells can be part of the same row, different rows, different columns, or any combination. In all cases, all of the data will be shown in the view pane.",
    project: "view-pane-demo",
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
            selected: "320925_Entries/age,320924_Entries/how_10x,320925_Entries/catchphrase,320924_Entries/catchphrase,320923_Entries/catchphrase,320921_Entries/catchphrase,320918_Entries/age,320920_Entries/catchphrase,320921_Entries/age"
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
    code: `
import unify
import random
from datetime import datetime, timedelta

unify.activate("view-pane-demo", overwrite=True)

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
`
}