/**
 * Interfaces / tiles fixtures for the dashboard builder surface.
 *
 * Shapes are kept Orchestra-native (the dispatch layer returns these directly)
 * so the existing casing pipeline converts them to camelCase for the UI.
 */

export const interfaceProjects = [
  { name: 'Assistants', description: 'Default assistant project' },
  { name: 'Growth', description: 'Marketing experiments' },
];

export const interfaceList = [
  {
    id: 'iface_overview',
    name: 'Overview',
    project: 'Assistants',
    tabs: [
      { id: 'tab_summary', name: 'Summary', order: 0 },
      { id: 'tab_activity', name: 'Activity', order: 1 },
    ],
  },
];

export const tileList = [
  {
    id: 'tile_runs',
    interfaceId: 'iface_overview',
    tabId: 'tab_summary',
    name: 'Runs over time',
    type: 'plot',
    layout: { x: 0, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  },
  {
    id: 'tile_table',
    interfaceId: 'iface_overview',
    tabId: 'tab_summary',
    name: 'Recent logs',
    type: 'table',
    layout: { x: 6, y: 0, w: 6, h: 4, minW: 2, minH: 2 },
  },
];
