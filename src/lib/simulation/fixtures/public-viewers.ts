/**
 * Fixtures for the public shared-view routes (table/plot).
 */

export const sharedTable = {
  columns: ['date', 'assistant', 'runs', 'costUsd'],
  rows: [
    { date: '2026-01-10', assistant: 'Maya Rivera', runs: 42, costUsd: 1.84 },
    { date: '2026-01-11', assistant: 'Leo Park', runs: 31, costUsd: 0.97 },
    { date: '2026-01-12', assistant: 'Nora Singh', runs: 58, costUsd: 2.31 },
  ],
};

export const sharedPlot = {
  title: 'Runs over time',
  series: [
    {
      name: 'runs',
      points: [
        { x: '2026-01-10', y: 42 },
        { x: '2026-01-11', y: 31 },
        { x: '2026-01-12', y: 58 },
        { x: '2026-01-13', y: 49 },
      ],
    },
  ],
};
