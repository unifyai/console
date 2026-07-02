import { describe, expect, it } from 'vitest';
import {
  FUNCTIONS_GRID_CLASS,
  readAutoFillGridColumnCount,
} from '@/utils/assistants/functionsGrid';

describe('functions grid layout', () => {
  it('exports the staging-approved responsive grid class', () => {
    expect(FUNCTIONS_GRID_CLASS).toContain('auto-fill');
    expect(FUNCTIONS_GRID_CLASS).toContain('15rem');
    expect(FUNCTIONS_GRID_CLASS).toContain('gap-4 p-4');
  });

  it('reads auto-fill column counts from computed styles', () => {
    const grid = document.createElement('div');
    grid.className = FUNCTIONS_GRID_CLASS;
    grid.style.width = '800px';
    document.body.appendChild(grid);
    Object.defineProperty(window, 'getComputedStyle', {
      configurable: true,
      value: () => ({
        gridTemplateColumns: '240px 240px 240px',
      }),
    });
    expect(readAutoFillGridColumnCount(grid)).toBe(3);
    document.body.removeChild(grid);
  });
});
