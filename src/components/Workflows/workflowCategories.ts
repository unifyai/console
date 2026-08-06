import type { CSSProperties } from 'react';
import type { WorkflowCategory, WorkflowSurfaceKind } from '@/types/workflows';

/**
 * The four curated categories, carried forward from the approved marketing shelf.
 * Colours are the existing role tokens — no new colour values are introduced.
 */
export const WORKFLOW_CATEGORIES: {
  id: WorkflowCategory;
  label: string;
  colorVar: string;
}[] = [
  { id: 'comms', label: 'Comms', colorVar: 'var(--role-orange)' },
  { id: 'growth', label: 'Growth', colorVar: 'var(--role-blue)' },
  { id: 'ops', label: 'Ops', colorVar: 'var(--role-green)' },
  { id: 'build', label: 'Build', colorVar: 'var(--role-cyan)' },
];

export const WORKFLOW_CATEGORY_LABEL: Record<WorkflowCategory, string> = {
  comms: 'Comms',
  growth: 'Growth',
  ops: 'Ops',
  build: 'Build',
};

/**
 * Sets `--wf-cat` so descendants can tint with
 * `bg-[color-mix(in_srgb,var(--wf-cat)_13%,transparent)]` etc.
 * Never hardcode the colour — always go through this helper.
 */
export function categoryStyle(category: WorkflowCategory): CSSProperties {
  const entry = WORKFLOW_CATEGORIES.find((candidate) => candidate.id === category);
  return { ['--wf-cat' as string]: entry?.colorVar ?? 'var(--primary)' } as CSSProperties;
}

/**
 * Where each planted surface actually lives. The Workflows surface owns nothing —
 * every manifest row links out to the ordinary rail section for that object.
 * `sectionId` keys into the rail's `SECTION_BY_ID` registry.
 */
export const WORKFLOW_SURFACES: Record<
  WorkflowSurfaceKind,
  {
    label: string;
    livesIn: string;
    sectionId: string;
    icon: 'compass' | 'braces' | 'listTodo' | 'bookOpen' | 'frame' | 'database';
  }
> = {
  procedures: { label: 'Procedures', livesIn: 'Guidance', sectionId: 'guidance', icon: 'compass' },
  functions: { label: 'Functions', livesIn: 'Functions', sectionId: 'functions', icon: 'braces' },
  tasks: { label: 'Recurring tasks', livesIn: 'Tasks', sectionId: 'tasks', icon: 'listTodo' },
  knowledge: {
    label: 'Knowledge claims',
    livesIn: 'Knowledge',
    sectionId: 'knowledge',
    icon: 'bookOpen',
  },
  canvases: { label: 'Canvases', livesIn: 'Canvas', sectionId: 'canvas', icon: 'frame' },
  tables: { label: 'Data tables', livesIn: 'Data', sectionId: 'data', icon: 'database' },
};

export const WORKFLOW_SURFACE_ORDER: WorkflowSurfaceKind[] = [
  'procedures',
  'functions',
  'tasks',
  'knowledge',
  'canvases',
  'tables',
];

export const WORKFLOW_CAPABILITY_COPY: Record<
  'computer' | 'filesystem',
  { title: string; detail: string }
> = {
  computer: {
    title: 'Needs a computer',
    detail: "This workflow runs code and browses in the teammate's own cloud computer.",
  },
  filesystem: {
    title: 'Needs filesystem access',
    detail: "It reads and writes files in the teammate's workspace.",
  },
};
