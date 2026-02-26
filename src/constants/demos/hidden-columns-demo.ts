const hiddenColumnsDemo = {
  gif: 'view_show_hide_dark',
  link: 'interfaces/views#hidden-columns',
  description:
    'Columns can be hidden by directly clicking the (-) icon which appears on hover, and also via the show / hide selector menu at the top. Column hiding in the view pane is totally independent from hidden columns in the table, making it easy to split the data across the two formats.',
  code: `import unify
import random

unify.activate("hidden-columns-demo", overwrite=True)

for question in ["what is 1 + 1?", "what is 2 + 2?", "what is 3 + 3?"]:
    student_answer = f"the answer is {random.randint(0, 6)}"
    parts = question[-4:-1].split()
    expected = int(parts[0]) + int(parts[2])
    correct_marks_to_award = int(int(student_answer[-1]) == expected)
    awarded_marks = random.randint(0, 1)
    rationale = f"the student answered {student_answer} "
    "and I gave them {awarded_marks} marks because I'm not "
    "good at maths, and {awarded_marks} is my favourite number"
    diff = correct_marks_to_award - awarded_marks
    error = abs(diff)
    unify.log(
        question,
        student_answer=student_answer,
        available_marks=1,
        awarded_marks=awarded_marks,
        rationale=rationale,
        correct_marks_to_award=correct_marks_to_award,
        diff=diff,
        error=error,
    )
`,
  // Granular interface structure
  interface: {
    projectId: 'hidden-columns-demo',
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
      hiddenColumns: 'Entries/question,Entries/student_answer,Entries/rationale',
      defaultHiddenColumns: true,
      selected:
        '320966_Entries/question,320966_Entries/student_answer,320966_Entries/available_marks,320966_Entries/awarded_marks,320966_Entries/rationale,320966_Entries/correct_marks_to_award,320966_Entries/diff,320966_Entries/error',
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

export default hiddenColumnsDemo;
