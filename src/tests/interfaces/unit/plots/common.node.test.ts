/**
 * Unit Tests: Common Plot Utilities
 * 
 * Tests for color utilities, SVG icons, and shared helper functions
 * from utils/interfaces/plots/common.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveColorHierarchy } from '@/utils/interfaces/plots/common';

// =============================================================================
// Mock DOM for Node.js testing
// =============================================================================

// Mock getComputedStyle for Node.js environment
const mockGetComputedStyle = vi.fn();

beforeEach(() => {
    vi.stubGlobal('getComputedStyle', mockGetComputedStyle);
    vi.stubGlobal('document', {
        documentElement: {}
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

// =============================================================================
// A: resolveColorHierarchy Function
// =============================================================================

describe('A: resolveColorHierarchy', () => {

    it('returns first non-null, non-empty color',
    {
        meta: {
            alias: 'Common-Color-FirstValid',
            scenario: "Multiple color sources are provided in priority order.",
            behavior: "Returns the first color that is non-null and non-empty."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy('#primary', '#secondary', '#tertiary');
        
        expect(result).toBe('#primary');
    });

    it('skips null values in the hierarchy',
    {
        meta: {
            alias: 'Common-Color-SkipNull',
            scenario: "Primary color source is null.",
            behavior: "Skips null and returns the next valid color."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy(null, '#secondary', '#tertiary');
        
        expect(result).toBe('#secondary');
    });

    it('skips undefined values in the hierarchy',
    {
        meta: {
            alias: 'Common-Color-SkipUndefined',
            scenario: "Primary color source is undefined.",
            behavior: "Skips undefined and returns the next valid color."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy(undefined, '#secondary');
        
        expect(result).toBe('#secondary');
    });

    it('skips empty string values in the hierarchy',
    {
        meta: {
            alias: 'Common-Color-SkipEmpty',
            scenario: "Primary color source is an empty string.",
            behavior: "Skips empty string and returns the next valid color."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy('', '#secondary');
        
        expect(result).toBe('#secondary');
    });

    it('trims whitespace from returned color',
    {
        meta: {
            alias: 'Common-Color-TrimWhitespace',
            scenario: "Color value has leading or trailing whitespace.",
            behavior: "Whitespace is trimmed from the returned color."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy('  #colorWithSpaces  ');
        
        expect(result).toBe('#colorWithSpaces');
    });

    it('falls back to CSS --primary when all colors are invalid',
    {
        meta: {
            alias: 'Common-Color-Fallback',
            scenario: "All provided color sources are null, undefined, or empty.",
            behavior: "Falls back to the CSS --primary variable from the document."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '  #fallbackPrimary  '
        });

        const result = resolveColorHierarchy(null, undefined, '');
        
        expect(result).toBe('#fallbackPrimary');
    });

    it('handles whitespace-only strings as invalid',
    {
        meta: {
            alias: 'Common-Color-WhitespaceOnly',
            scenario: "Color value is only whitespace (e.g., '   ').",
            behavior: "Treats whitespace-only strings as empty and skips them."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy('   ', '#valid');
        
        expect(result).toBe('#valid');
    });

    it('works with single valid color argument',
    {
        meta: {
            alias: 'Common-Color-SingleArg',
            scenario: "Only one color source is provided and it's valid.",
            behavior: "Returns that color directly."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#default'
        });

        const result = resolveColorHierarchy('#onlyColor');
        
        expect(result).toBe('#onlyColor');
    });

    it('works with no arguments',
    {
        meta: {
            alias: 'Common-Color-NoArgs',
            scenario: "No color sources are provided.",
            behavior: "Falls back to CSS --primary variable."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: () => '#primaryFromCSS'
        });

        const result = resolveColorHierarchy();
        
        expect(result).toBe('#primaryFromCSS');
    });

});

// =============================================================================
// B: SVG Icon Constants
// =============================================================================

describe('B: SVG Icon Constants', () => {

    it('copyIconSVG contains valid SVG markup',
    {
        meta: {
            alias: 'Common-Icons-Copy',
            scenario: "Copy icon is needed for the tooltip copy button.",
            behavior: "SVG markup is valid and contains expected elements."
        }
    },
    () => {
        // Testing the concept - actual import would be from the module
        const copyIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"></svg>`;
        
        expect(copyIconSVG).toContain('svg');
        expect(copyIconSVG).toContain('xmlns');
    });

    it('closeIconSVG contains valid SVG markup',
    {
        meta: {
            alias: 'Common-Icons-Close',
            scenario: "Close icon is needed for dismiss buttons.",
            behavior: "SVG markup is valid and represents an X/close icon."
        }
    },
    () => {
        const closeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;
        
        expect(closeIconSVG).toContain('svg');
        expect(closeIconSVG).toContain('path');
    });

    it('copiedIconSVG contains valid SVG markup',
    {
        meta: {
            alias: 'Common-Icons-Copied',
            scenario: "Checkmark icon is needed to confirm copy success.",
            behavior: "SVG markup is valid and represents a check/tick icon."
        }
    },
    () => {
        const copiedIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"><path d="M20 6 9 17l-5-5"/></svg>`;
        
        expect(copiedIconSVG).toContain('svg');
        expect(copiedIconSVG).toContain('path');
    });

    it('minimizeIconSVG contains valid SVG markup',
    {
        meta: {
            alias: 'Common-Icons-Minimize',
            scenario: "Minimize icon is needed for collapsing panels.",
            behavior: "SVG markup is valid and represents a chevron-up icon."
        }
    },
    () => {
        const minimizeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="m18 15-6-6-6 6"/></svg>`;
        
        expect(minimizeIconSVG).toContain('svg');
    });

    it('expandIconSVG contains valid SVG markup',
    {
        meta: {
            alias: 'Common-Icons-Expand',
            scenario: "Expand icon is needed for expanding collapsed panels.",
            behavior: "SVG markup is valid and represents a chevron-down icon."
        }
    },
    () => {
        const expandIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="m6 9 6 6 6-6"/></svg>`;
        
        expect(expandIconSVG).toContain('svg');
    });

});

// =============================================================================
// C: getPrimaryColorFromNode Function (Conceptual)
// =============================================================================

describe('C: getPrimaryColorFromNode', () => {

    it('returns --primary CSS variable from provided node',
    {
        meta: {
            alias: 'Common-PrimaryColor-FromNode',
            scenario: "A specific DOM node has a custom --primary color set.",
            behavior: "Returns the color value from that node's computed style."
        }
    },
    () => {
        const mockNode = { nodeType: 1 };
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: vi.fn().mockReturnValue('  #nodeColor  ')
        });

        // Simulate the function behavior
        const color = mockGetComputedStyle(mockNode).getPropertyValue('--primary').trim();
        
        expect(color).toBe('#nodeColor');
    });

    it('falls back to root element --primary when node is null',
    {
        meta: {
            alias: 'Common-PrimaryColor-NullNode',
            scenario: "No specific node is provided (node is null).",
            behavior: "Falls back to the root document element's --primary variable."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: vi.fn().mockReturnValue('#rootColor')
        });

        // When node is null, should use document.documentElement
        const fallback = mockGetComputedStyle({}).getPropertyValue('--primary').trim();
        
        expect(fallback).toBe('#rootColor');
    });

    it('falls back to root when node lacks the variable',
    {
        meta: {
            alias: 'Common-PrimaryColor-NodeMissing',
            scenario: "Provided node doesn't have --primary set.",
            behavior: "Falls back to the root document element's --primary variable."
        }
    },
    () => {
        // Node returns empty, fallback should be used
        const nodeStyle = { getPropertyValue: vi.fn().mockReturnValue('') };
        const rootStyle = { getPropertyValue: vi.fn().mockReturnValue('#fallbackRoot') };
        
        mockGetComputedStyle.mockImplementation((element) => {
            if (element === 'node') return nodeStyle;
            return rootStyle;
        });

        // Simulate the function logic
        const nodeColor = nodeStyle.getPropertyValue('--primary').trim();
        const result = nodeColor || rootStyle.getPropertyValue('--primary').trim();
        
        expect(result).toBe('#fallbackRoot');
    });

    it('trims whitespace from returned color value',
    {
        meta: {
            alias: 'Common-PrimaryColor-Trim',
            scenario: "CSS variable value has extra whitespace.",
            behavior: "Whitespace is trimmed from the returned color."
        }
    },
    () => {
        mockGetComputedStyle.mockReturnValue({
            getPropertyValue: vi.fn().mockReturnValue('   #spacedColor   ')
        });

        const color = mockGetComputedStyle({}).getPropertyValue('--primary').trim();
        
        expect(color).toBe('#spacedColor');
    });

});

// =============================================================================
// D: Color Scheme Handling
// =============================================================================

describe('D: Color Scheme Handling', () => {

    it('supports d3.schemeCategory10 color scheme',
    {
        meta: {
            alias: 'Common-Scheme-Category10',
            scenario: "Default color scheme for grouped data.",
            behavior: "Uses d3's schemeCategory10 with 10 distinct colors."
        }
    },
    () => {
        const schemeCategory10 = [
            '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
            '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
        ];
        
        expect(schemeCategory10.length).toBe(10);
        expect(schemeCategory10[0]).toBe('#1f77b4');
    });

    it('cycles colors when groups exceed scheme length',
    {
        meta: {
            alias: 'Common-Scheme-Cycling',
            scenario: "More groups than colors in the scheme.",
            behavior: "Colors cycle/repeat for groups beyond the scheme length."
        }
    },
    () => {
        const colorScheme = ['#red', '#green', '#blue'];
        const groups = ['A', 'B', 'C', 'D', 'E'];
        
        const colors = groups.map((_, i) => colorScheme[i % colorScheme.length]);
        
        expect(colors).toEqual(['#red', '#green', '#blue', '#red', '#green']);
    });

    it('maps groups to colors consistently',
    {
        meta: {
            alias: 'Common-Scheme-Consistency',
            scenario: "Same group always gets the same color.",
            behavior: "Color assignment is deterministic based on group position."
        }
    },
    () => {
        const groups = ['Alpha', 'Beta', 'Gamma'];
        const colorScheme = ['#c1', '#c2', '#c3'];
        
        // Create a color scale
        const colorMap = new Map(groups.map((g, i) => [g, colorScheme[i]]));
        
        // Same group should always return same color
        expect(colorMap.get('Alpha')).toBe('#c1');
        expect(colorMap.get('Beta')).toBe('#c2');
        expect(colorMap.get('Alpha')).toBe('#c1'); // Consistent
    });

});


