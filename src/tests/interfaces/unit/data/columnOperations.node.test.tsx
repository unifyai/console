import { describe, it, expect } from 'vitest';
import {
  sanitizeId,
  getParentID,
  hasSameParent,
  isLastSameParentColumnInColumnOrder,
  processContext,
  flattenColumnIDs,
  getAllChildColumns,
  isAllChildrenGrouped,
  updateColumnVisibility,
} from '@/utils/interfaces/table/columnOperations';
import type { Column, ColumnDef } from '@tanstack/react-table';

function makeColumnDef(id: string, isParent = false, renderedDepth?: number): ColumnDef<any> {
  return {
    id,
    meta: {
      isParent,
      renderedDepth,
    },
  } as any;
}

function makeColumn(id: string, def: ColumnDef<any>, children: Column<any>[] = []): Column<any> {
  return {
    id,
    columnDef: def,
    columns: children,
  } as any;
}

describe('columnOperations helpers', () => {
  it('sanitizeId removes Parameters/ and Entries/ prefixes', () => {
    expect(sanitizeId('Parameters/level')).toBe('level');
    expect(sanitizeId('Entries/message')).toBe('message');
    expect(sanitizeId('other/path')).toBe('other/path');
  });

  it('getParentID and hasSameParent work for nested paths', () => {
    expect(getParentID('foo/bar/baz')).toBe('foo/bar');
    expect(getParentID('root')).toBeUndefined();

    expect(hasSameParent('foo/bar/a', 'foo/bar/b')).toBe(true);
    expect(hasSameParent('foo/x/a', 'foo/y/b')).toBe(false);
  });

  it('isLastSameParentColumnInColumnOrder detects last child with same parent', () => {
    const columnOrder = ['student/gender', 'student/age', 'question/text'];
    const visibility = {
      'student/gender': true,
      'student/age': true,
      'question/text': true,
    };

    const colGender = { id: 'student/gender' } as Column<any, unknown>;
    const colAge = { id: 'student/age' } as Column<any, unknown>;

    // gender is followed by another child of same parent -> not last
    expect(isLastSameParentColumnInColumnOrder(colGender, columnOrder, visibility)).toBe(false);
    // age is followed by a different parent -> last for "student"
    expect(isLastSameParentColumnInColumnOrder(colAge, columnOrder, visibility)).toBe(true);
  });

  it('processContext splits and merges context safely', () => {
    // split
    expect(processContext('split', 'Academics/STEM', 'Academics/STEM/Physics')).toBe('Physics');
    expect(processContext('split', 'Academics', 'Other/Path')).toBe('Other/Path');
    expect(processContext('split', null, 'PlainField')).toBe('PlainField');

    // merge
    expect(processContext('merge', 'Academics/STEM', 'Physics')).toBe('Academics/STEM/Physics');
    expect(processContext('merge', null, 'Physics')).toBe('Physics');
    expect(processContext('merge', 'Academics', null)).toBe('Academics');
  });

  it('flattenColumnIDs flattens nested ColumnDef trees', () => {
    const cols: ColumnDef<any>[] = [
      {
        id: 'root',
        columns: [
          { id: 'root/child1' },
          {
            id: 'root/child2',
            columns: [{ id: 'root/child2/grandchild' }],
          },
        ],
      } as any,
    ];

    const result = flattenColumnIDs(cols);
    expect(result).toEqual([
      'root',
      'root/child1',
      'root/child2',
      'root/child2/grandchild',
    ]);
  });

  it('getAllChildColumns returns all descendants for parent columns', () => {
    const child1 = makeColumn('parent/child1', makeColumnDef('parent/child1'));
    const child2 = makeColumn('parent/child2', makeColumnDef('parent/child2'));
    const parent = makeColumn('parent', makeColumnDef('parent', true), [child1, child2]);

    const children = getAllChildColumns(parent);
    const ids = children.map((c) => c.id);
    expect(ids.sort()).toEqual(['parent/child1', 'parent/child2'].sort());
  });

  it('isAllChildrenGrouped returns true only when all children ids are in grouping', () => {
    const child1 = makeColumn('student/gender', makeColumnDef('student/gender'));
    const child2 = makeColumn('student/age', makeColumnDef('student/age'));
    const parent = makeColumn('student', makeColumnDef('student', true), [child1, child2]);

    expect(isAllChildrenGrouped(parent, ['student/gender', 'student/age'])).toBe(true);
    expect(isAllChildrenGrouped(parent, ['student/gender'])).toBe(false);
  });

  it('updateColumnVisibility updates children and parents consistently', () => {
    const initialVisibility = {
      parent: true,
      'parent/child1': true,
      'parent/child2': true,
    };

    // Toggling parent to false should hide all children and parent
    const allHidden = updateColumnVisibility(initialVisibility, 'parent', false);
    expect(allHidden).toEqual({
      parent: false,
      'parent/child1': false,
      'parent/child2': false,
    });

    // Start with all hidden, toggle child1 to true then child2 to true
    let vis = {
      parent: false,
      'parent/child1': false,
      'parent/child2': false,
    };
    vis = updateColumnVisibility(vis, 'parent/child1', true);
    expect(vis['parent/child1']).toBe(true);
    expect(vis.parent).toBe(false);

    vis = updateColumnVisibility(vis, 'parent/child2', true);
    expect(vis['parent/child2']).toBe(true);
    // Now all children are visible, parent should be visible as well
    expect(vis.parent).toBe(true);
  });
});


