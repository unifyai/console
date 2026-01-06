/**
 * P2-H: Compute Diff Unit Tests (Node.js)
 * 
 * These tests verify the real computeSpanDiffByName and wrapAsRootSpan functions
 * from computeDiff.ts. These run in Node.js because the difflib package has
 * browser compatibility issues.
 * 
 * The browser integration tests use mocked versions of these functions.
 */
import { describe, it, expect } from 'vitest';
import { computeSpanDiffByName, wrapAsRootSpan } from '@/components/Pages/Interfaces/Blocks/Selection/Views/TraceView/computeDiff';
import { Span } from '@/types/interfaces/traces';

describe('P2-H: Compute Diff (Real Implementation)', () => {
  describe('wrapAsRootSpan', () => {
    it('creates synthetic root with child spans', () => {
      const spans: Span[] = [
        { id: 'span-1', span_name: 'Span1' },
        { id: 'span-2', span_name: 'Span2' },
      ];

      const result = wrapAsRootSpan(spans, 'synthetic-root');

      expect(result.id).toBe('synthetic-root');
      expect(result.span_name).toBe('ROOT');
      expect(result.child_spans).toHaveLength(2);
      expect(result.child_spans![0].span_name).toBe('Span1');
      expect(result.child_spans![1].span_name).toBe('Span2');
    });

    it('handles empty spans array', () => {
      const result = wrapAsRootSpan([], 'empty-root');

      expect(result.id).toBe('empty-root');
      expect(result.span_name).toBe('ROOT');
      expect(result.child_spans).toHaveLength(0);
    });
  });

  describe('computeSpanDiffByName', () => {
    it('returns empty node for undefined inputs', () => {
      const result = computeSpanDiffByName(undefined, undefined);

      expect(result.name).toBe('');
      expect(result.marker).toBe(' ');
      expect(result.children).toHaveLength(0);
    });

    it('marks removed spans with minus marker', () => {
      const baseSpan: Span = {
        id: 'span-1',
        span_name: 'RemovedSpan',
      };

      const result = computeSpanDiffByName(baseSpan, undefined);

      expect(result.name).toBe('RemovedSpan');
      expect(result.marker).toBe('-');
      expect(result.baseSpanRef).toBe(baseSpan);
      expect(result.targetSpanRef).toBeUndefined();
    });

    it('marks added spans with plus marker', () => {
      const targetSpan: Span = {
        id: 'span-1',
        span_name: 'AddedSpan',
      };

      const result = computeSpanDiffByName(undefined, targetSpan);

      expect(result.name).toBe('AddedSpan');
      expect(result.marker).toBe('+');
      expect(result.baseSpanRef).toBeUndefined();
      expect(result.targetSpanRef).toBe(targetSpan);
    });

    it('marks replaced spans (different names) with r marker', () => {
      const baseSpan: Span = {
        id: 'span-1',
        span_name: 'OldName',
      };
      const targetSpan: Span = {
        id: 'span-2',
        span_name: 'NewName',
      };

      const result = computeSpanDiffByName(baseSpan, targetSpan);

      expect(result.marker).toBe('r');
      expect(result.children).toHaveLength(2);
      expect(result.children[0].marker).toBe('-');
      expect(result.children[0].name).toBe('OldName');
      expect(result.children[1].marker).toBe('+');
      expect(result.children[1].name).toBe('NewName');
    });

    it('marks identical spans as unchanged', () => {
      const span: Span = {
        id: 'span-1',
        span_name: 'SameName',
      };

      const result = computeSpanDiffByName(span, span);

      expect(result.name).toBe('SameName');
      expect(result.marker).toBe(' ');
    });

    it('handles nested child spans with same names', () => {
      const baseSpan: Span = {
        id: 'parent',
        span_name: 'Parent',
        child_spans: [
          { id: 'child-1', span_name: 'Child1' },
          { id: 'child-2', span_name: 'Child2' },
        ],
      };
      const targetSpan: Span = {
        id: 'parent',
        span_name: 'Parent',
        child_spans: [
          { id: 'child-1', span_name: 'Child1' },
          { id: 'child-2', span_name: 'Child2' },
        ],
      };

      const result = computeSpanDiffByName(baseSpan, targetSpan);

      expect(result.name).toBe('Parent');
      expect(result.marker).toBe(' ');
      expect(result.children).toHaveLength(2);
      expect(result.children[0].marker).toBe(' ');
      expect(result.children[1].marker).toBe(' ');
    });

    it('detects added child spans', () => {
      const baseSpan: Span = {
        id: 'parent',
        span_name: 'Parent',
        child_spans: [
          { id: 'child-1', span_name: 'Child1' },
        ],
      };
      const targetSpan: Span = {
        id: 'parent',
        span_name: 'Parent',
        child_spans: [
          { id: 'child-1', span_name: 'Child1' },
          { id: 'child-2', span_name: 'Child2' },
        ],
      };

      const result = computeSpanDiffByName(baseSpan, targetSpan);

      expect(result.name).toBe('Parent');
      expect(result.marker).toBe(' ');
      expect(result.children.length).toBeGreaterThanOrEqual(2);
      
      // Find the added child
      const addedChild = result.children.find(c => c.name === 'Child2');
      expect(addedChild).toBeDefined();
      expect(addedChild!.marker).toBe('+');
    });

    it('detects removed child spans', () => {
      const baseSpan: Span = {
        id: 'parent',
        span_name: 'Parent',
        child_spans: [
          { id: 'child-1', span_name: 'Child1' },
          { id: 'child-2', span_name: 'Child2' },
        ],
      };
      const targetSpan: Span = {
        id: 'parent',
        span_name: 'Parent',
        child_spans: [
          { id: 'child-1', span_name: 'Child1' },
        ],
      };

      const result = computeSpanDiffByName(baseSpan, targetSpan);

      expect(result.name).toBe('Parent');
      expect(result.marker).toBe(' ');
      
      // Find the removed child
      const removedChild = result.children.find(c => c.name === 'Child2');
      expect(removedChild).toBeDefined();
      expect(removedChild!.marker).toBe('-');
    });

    it('handles deeply nested spans', () => {
      const baseSpan: Span = {
        id: 'root',
        span_name: 'Root',
        child_spans: [
          {
            id: 'level1',
            span_name: 'Level1',
            child_spans: [
              {
                id: 'level2',
                span_name: 'Level2',
                child_spans: [
                  { id: 'level3', span_name: 'Level3' },
                ],
              },
            ],
          },
        ],
      };

      const result = computeSpanDiffByName(baseSpan, baseSpan);

      expect(result.name).toBe('Root');
      expect(result.marker).toBe(' ');
      expect(result.children).toHaveLength(1);
      expect(result.children[0].name).toBe('Level1');
      expect(result.children[0].children).toHaveLength(1);
      expect(result.children[0].children[0].name).toBe('Level2');
    });

    it('handles spans with undefined child_spans', () => {
      const baseSpan: Span = {
        id: 'span-1',
        span_name: 'NoChildren',
        // child_spans is undefined
      };

      const result = computeSpanDiffByName(baseSpan, baseSpan);

      expect(result.name).toBe('NoChildren');
      expect(result.marker).toBe(' ');
      expect(result.children).toHaveLength(0);
    });
  });
});

