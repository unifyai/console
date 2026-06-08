export interface RandomMartianProfile {
  firstName: string;
  surname: string;
  jobTitle: string;
  about: string;
}

const firstNames = [
  'Astra',
  'Cato',
  'Kivo',
  'Luma',
  'Mira',
  'Nilo',
  'Orin',
  'Rilo',
  'Sera',
  'Solin',
  'Tavo',
  'Vexa',
  'Zeno',
] as const;

const surnames = [
  'Canal',
  'Craterly',
  'Dunewright',
  'Moondrift',
  'Orbiton',
  'Redridge',
  'Rockhopper',
  'Solward',
  'Starling',
  'Valles',
] as const;

const roles = [
  'Inbox Pathfinder',
  'Ops Quartermaster',
  'Launch Coordinator',
  'Workflow Fixer',
  'Research Scout',
  'Calendar Wrangler',
  'Project Runner',
  'Signal Finder',
  'Task Pilot',
  'Execution Specialist',
] as const;

const abouts = [
  'Raised near Olympus Mons, this martian is calm under pressure and unusually good at turning loose plans into finished work. Loves a tidy checklist, hates letting small follow-ups drift into orbit.',
  'A practical operator from the Valles Marineris side of Mars. Finds the next useful step quickly, keeps threads moving, and has a soft spot for clean handoffs and suspiciously well-labeled notes.',
  'Built for momentum: collects scattered context, turns it into a plan, and keeps nudging until the thing is done. Claims the best thinking happens during low-gravity walks across the red dunes.',
  'A steady systems-minded martian who enjoys making messy work feel simple. Good at chasing details, closing loops, and remembering the tiny thing everyone else forgot after lunch.',
  'Part researcher, part operator, part mission control. This martian likes crisp priorities, fast summaries, and quietly making progress while everyone else is still naming the project.',
  'Known around the crater for getting practical work over the line without drama. Brings a dry sense of humor, a good memory for context, and a habit of turning vague asks into concrete next actions.',
] as const;

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export function createRandomMartianProfile(): RandomMartianProfile {
  return {
    firstName: pick(firstNames),
    surname: pick(surnames),
    jobTitle: pick(roles),
    about: pick(abouts),
  };
}
