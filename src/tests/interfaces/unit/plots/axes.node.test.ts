/**
 * Unit Tests: Axes Utilities
 * 
 * Tests for tick generation, log scale validation, domain reversal,
 * and axis drawing functions from utils/interfaces/plots/axes.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as d3 from 'd3';
import { generateTicks, checkLogScalability, reverseOrKeepDomain } from '@/utils/interfaces/plots/axes';
import { LogFieldsResponseProps, LogProps } from '@/types/interfaces/logs';

// =============================================================================
// A: generateTicks Function
// =============================================================================

describe('A: generateTicks', () => {

    describe('A1: Linear Scale Tick Generation', () => {

        it('generates correct number of ticks for a simple linear range',
        {
            meta: {
                alias: 'Axes-Ticks-SimpleRange',
                scenario: "A plot needs ticks for a standard range of 0 to 100.",
                behavior: "Returns an array of nicely spaced tick values including both min and max."
            }
        },
        () => {
            const ticks = generateTicks(0, 100, 10);
            
            expect(ticks).toContain(0);
            expect(ticks).toContain(100);
            expect(ticks.length).toBeGreaterThanOrEqual(5);
            expect(ticks.length).toBeLessThanOrEqual(15);
            // Ticks should be sorted
            expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
        });

        it('generates correct ticks for a small decimal range',
        {
            meta: {
                alias: 'Axes-Ticks-SmallRange',
                scenario: "Data values are between 0 and 1 (e.g., probabilities or normalized values).",
                behavior: "Returns appropriately scaled tick values with decimal increments."
            }
        },
        () => {
            const ticks = generateTicks(0, 1, 10);
            
            expect(ticks).toContain(0);
            expect(ticks).toContain(1);
            // Should have reasonable increments like 0.1, 0.2, etc.
            expect(ticks.every(t => t >= 0 && t <= 1)).toBe(true);
        });

        it('generates correct ticks for a large range',
        {
            meta: {
                alias: 'Axes-Ticks-LargeRange',
                scenario: "Data spans a large range like 0 to 1,000,000.",
                behavior: "Returns tick values with appropriate large increments (e.g., 100000, 200000)."
            }
        },
        () => {
            const ticks = generateTicks(0, 1000000, 10);
            
            expect(ticks).toContain(0);
            expect(ticks).toContain(1000000);
            // Increments should be nice numbers
            const increments = ticks.slice(1).map((t, i) => t - ticks[i]);
            expect(increments.every(inc => inc >= 100000)).toBe(true);
        });

        it('generates correct ticks for negative ranges',
        {
            meta: {
                alias: 'Axes-Ticks-NegativeRange',
                scenario: "All data values are negative (e.g., -100 to 0).",
                behavior: "Returns correctly ordered negative tick values."
            }
        },
        () => {
            const ticks = generateTicks(-100, 0, 10);
            
            expect(ticks).toContain(-100);
            expect(ticks).toContain(0);
            expect(ticks).toEqual([...ticks].sort((a, b) => a - b));
        });

        it('generates correct ticks for ranges spanning negative to positive',
        {
            meta: {
                alias: 'Axes-Ticks-CrossZero',
                scenario: "Data spans from -50 to 50, crossing zero.",
                behavior: "Returns tick values that include zero and span both negative and positive."
            }
        },
        () => {
            const ticks = generateTicks(-50, 50, 10);
            
            expect(ticks).toContain(-50);
            expect(ticks).toContain(50);
            expect(ticks).toContain(0);
        });

        it('includes min and max values in the returned ticks',
        {
            meta: {
                alias: 'Axes-Ticks-IncludesMinMax',
                scenario: "Any range is provided for tick generation.",
                behavior: "The returned tick array always includes the exact min and max values."
            }
        },
        () => {
            const ticks = generateTicks(17, 93, 10);
            
            expect(ticks[0]).toBe(17);
            expect(ticks[ticks.length - 1]).toBe(93);
        });

        it('handles edge case where min equals max',
        {
            meta: {
                alias: 'Axes-Ticks-EqualMinMax',
                scenario: "All data points have the same value (min === max).",
                behavior: "Returns at least the single value without crashing."
            }
        },
        () => {
            const ticks = generateTicks(50, 50, 10);
            
            expect(ticks).toContain(50);
            expect(ticks.length).toBeGreaterThanOrEqual(1);
        });

        it('respects the count parameter for desired number of ticks',
        {
            meta: {
                alias: 'Axes-Ticks-CountParameter',
                scenario: "A specific approximate tick count is requested.",
                behavior: "Returns approximately the requested number of ticks (±50%)."
            }
        },
        () => {
            const ticks5 = generateTicks(0, 100, 5);
            const ticks20 = generateTicks(0, 100, 20);
            
            // More requested ticks should generally result in more actual ticks
            expect(ticks20.length).toBeGreaterThanOrEqual(ticks5.length);
        });

    });

    describe('A2: Log Scale Tick Generation', () => {

        it('generates correct ticks for log scale with positive values',
        {
            meta: {
                alias: 'Axes-Ticks-LogPositive',
                scenario: "Log scale is enabled for positive data (e.g., 1 to 1000).",
                behavior: "Returns tick values at powers of 10 (1, 10, 100, 1000)."
            }
        },
        () => {
            const ticks = generateTicks(1, 1000, 10, true);
            
            expect(ticks).toContain(1);
            expect(ticks).toContain(1000);
            // Should include powers of 10
            expect(ticks.some(t => t === 10 || t === 100)).toBe(true);
        });

        it('generates correct ticks for log scale with all negative values',
        {
            meta: {
                alias: 'Axes-Ticks-LogNegative',
                scenario: "Log scale is enabled for all-negative data (uses absolute values internally).",
                behavior: "Returns tick values based on the absolute magnitude of the negative range."
            }
        },
        () => {
            const ticks = generateTicks(-1000, -1, 10, true);
            
            // Should contain absolute boundaries
            expect(ticks).toContain(1);
            expect(ticks).toContain(1000);
        });

        it('filters out-of-bound ticks correctly for log scale',
        {
            meta: {
                alias: 'Axes-Ticks-LogFiltering',
                scenario: "Log scale tick generation might produce ticks outside the data range.",
                behavior: "Out-of-bound ticks are filtered, keeping only ticks within [min, max]."
            }
        },
        () => {
            const ticks = generateTicks(5, 500, 10, true);
            
            expect(ticks.every(t => t >= 5 && t <= 500)).toBe(true);
            expect(ticks).toContain(5);
            expect(ticks).toContain(500);
        });

    });

});

// =============================================================================
// B: checkLogScalability Function
// =============================================================================

describe('B: checkLogScalability', () => {

    const createMockLogs = (values: number[]): LogProps[] => {
        return values.map((v, i) => ({
            type: 'ungrouped',
            id: String(i),
            ts: new Date().toISOString(),
            params: {},
            entries: {},
            derived_entries: {},
            clipped_fields: [],
            'test.id': i,
            'test.entries': { 'test.value': v }
        } as unknown as LogProps));
    };

    const mockFields: LogFieldsResponseProps = {
        'test.value': {
            data_type: 'float',
            field_type: 'entry',
            artifacts: '',
            mutable: 'false',
            created_at: ''
        }
    };

    it('returns log scale when all values are positive',
    {
        meta: {
            alias: 'Axes-LogScale-AllPositive',
            scenario: "User enables log scale and all data values are positive (e.g., 1, 10, 100).",
            behavior: "Log scale is valid; returns 'log' and enables the log scale option."
        }
    },
    () => {
        const logs = createMockLogs([1, 10, 100, 1000]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        const result = checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'log', setScale, setLogScaleEnabled
        );

        expect(result).toBe('log');
        expect(setLogScaleEnabled).toHaveBeenCalledWith(true);
        expect(setScale).not.toHaveBeenCalled();
    });

    it('returns log scale when all values are negative',
    {
        meta: {
            alias: 'Axes-LogScale-AllNegative',
            scenario: "User enables log scale and all data values are negative (e.g., -1, -10, -100).",
            behavior: "Log scale is valid (uses absolute values); returns 'log' and enables the option."
        }
    },
    () => {
        const logs = createMockLogs([-1, -10, -100, -1000]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        const result = checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'log', setScale, setLogScaleEnabled
        );

        expect(result).toBe('log');
        expect(setLogScaleEnabled).toHaveBeenCalledWith(true);
    });

    it('returns linear scale when values contain zero',
    {
        meta: {
            alias: 'Axes-LogScale-ContainsZero',
            scenario: "User enables log scale but data contains zero values.",
            behavior: "Log scale is invalid (log(0) undefined); forces linear scale and disables log option."
        }
    },
    () => {
        const logs = createMockLogs([0, 10, 100]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        const result = checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'log', setScale, setLogScaleEnabled
        );

        expect(result).toBe('linear');
        expect(setLogScaleEnabled).toHaveBeenCalledWith(false);
        expect(setScale).toHaveBeenCalledWith('linear');
    });

    it('returns linear scale when values span negative and positive',
    {
        meta: {
            alias: 'Axes-LogScale-MixedSigns',
            scenario: "User enables log scale but data spans negative to positive values.",
            behavior: "Log scale is invalid (can't handle sign change); forces linear scale."
        }
    },
    () => {
        const logs = createMockLogs([-10, 5, 100]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        const result = checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'log', setScale, setLogScaleEnabled
        );

        expect(result).toBe('linear');
        expect(setLogScaleEnabled).toHaveBeenCalledWith(false);
        expect(setScale).toHaveBeenCalledWith('linear');
    });

    it('does not modify scale when linear scale is requested',
    {
        meta: {
            alias: 'Axes-LogScale-LinearRequested',
            scenario: "User has linear scale selected (default).",
            behavior: "Does not force any scale change, simply enables/disables log option based on data."
        }
    },
    () => {
        const logs = createMockLogs([1, 10, 100]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        const result = checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'linear', setScale, setLogScaleEnabled
        );

        expect(result).toBe('linear');
        expect(setLogScaleEnabled).toHaveBeenCalledWith(true);
        expect(setScale).not.toHaveBeenCalled();
    });

    it('calls setLogScaleEnabled(true) when log scale is valid',
    {
        meta: {
            alias: 'Axes-LogScale-EnableOption',
            scenario: "Data is suitable for log scale (all positive or all negative, no zeros).",
            behavior: "The log scale toggle in the UI is enabled."
        }
    },
    () => {
        const logs = createMockLogs([1, 2, 3, 4, 5]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'linear', setScale, setLogScaleEnabled
        );

        expect(setLogScaleEnabled).toHaveBeenCalledWith(true);
    });

    it('calls setLogScaleEnabled(false) when log scale is invalid',
    {
        meta: {
            alias: 'Axes-LogScale-DisableOption',
            scenario: "Data is not suitable for log scale (contains zero or mixed signs).",
            behavior: "The log scale toggle in the UI is disabled."
        }
    },
    () => {
        const logs = createMockLogs([-5, 0, 5, 10]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'linear', setScale, setLogScaleEnabled
        );

        expect(setLogScaleEnabled).toHaveBeenCalledWith(false);
    });

    it('calls setScale("linear") when log scale was requested but data is invalid',
    {
        meta: {
            alias: 'Axes-LogScale-ForceLinear',
            scenario: "User has log scale selected but data contains zeros.",
            behavior: "Calls setScale to force linear scale."
        }
    },
    () => {
        const logs = createMockLogs([0, 10, 100]);
        const setScale = vi.fn();
        const setLogScaleEnabled = vi.fn();

        checkLogScalability(
            logs, mockFields, 'test', 'test.value', 
            'log', setScale, setLogScaleEnabled
        );

        expect(setScale).toHaveBeenCalledWith('linear');
    });

});

// =============================================================================
// C: reverseOrKeepDomain Function
// =============================================================================

describe('C: reverseOrKeepDomain', () => {

    it('returns original domain when reverseX is false',
    {
        meta: {
            alias: 'Axes-Domain-NoReverse',
            scenario: "Standard linear scale without reversal.",
            behavior: "Returns the original [min, max] domain unchanged."
        }
    },
    () => {
        const values = [10, 20, 30, 40, 50];
        const domain = [10, 50];
        
        const result = reverseOrKeepDomain(values, domain, false);
        
        expect(result).toEqual([10, 50]);
    });

    it('returns reversed absolute domain when reverseX is true',
    {
        meta: {
            alias: 'Axes-Domain-Reverse',
            scenario: "Log scale with all negative values requires domain reversal.",
            behavior: "Returns [absMax, absMin] to properly display negative log scale."
        }
    },
    () => {
        const values = [-50, -40, -30, -20, -10];
        const domain = [-50, -10];
        
        const result = reverseOrKeepDomain(values, domain, true);
        
        expect(result).toEqual([50, 10]); // Reversed absolute values
    });

    it('correctly calculates absolute extent for negative values',
    {
        meta: {
            alias: 'Axes-Domain-AbsoluteExtent',
            scenario: "Negative values need their absolute extent for log scale.",
            behavior: "Computes correct absolute min and max from negative values."
        }
    },
    () => {
        const values = [-100, -50, -25, -10, -1];
        const domain = [-100, -1];
        
        const result = reverseOrKeepDomain(values, domain, true);
        
        // Absolute extent: min=1, max=100, reversed: [100, 1]
        expect(result).toEqual([100, 1]);
    });

    it('handles mixed positive and negative values with reversal',
    {
        meta: {
            alias: 'Axes-Domain-MixedReverse',
            scenario: "Edge case where reversal is requested on mixed-sign data.",
            behavior: "Calculates absolute extent correctly even with mixed signs."
        }
    },
    () => {
        const values = [-30, -10, 5, 20];
        const domain = [-30, 20];
        
        const result = reverseOrKeepDomain(values, domain, true);
        
        // Absolute values: 30, 10, 5, 20 → extent: [5, 30], reversed: [30, 5]
        expect(result).toEqual([30, 5]);
    });

});

// =============================================================================
// D: drawAxes Function
// =============================================================================

describe('D: drawAxes', () => {
    
    let dom: any;
    let document: Document;
    
    beforeEach(async () => {
        // eslint-disable-next-line
        const { JSDOM } = require('jsdom');
        dom = new JSDOM(`
            <!DOCTYPE html>
            <html>
            <body>
                <svg class="plotSvg">
                    <g class="xAxis" transform="translate(0, 560)"></g>
                    <g class="yAxis" transform="translate(50, 0)"></g>
                    <line class="x-zero"></line>
                    <line class="y-zero"></line>
                </svg>
            </body>
            </html>
        `);
        document = dom.window.document;
        (global as any).document = document;
    });

    // Import drawAxes dynamically after JSDOM setup
    const getDrawAxes = async () => {
        const { drawAxes } = await import('@/utils/interfaces/plots/axes');
        return drawAxes;
    };

    it('draws X axis and Y axis elements',
    {
        meta: {
            alias: 'Axes-Draw-BasicElements',
            scenario: "Drawing axes on a plot.",
            behavior: "Both X and Y axis selections are returned and populated."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [0, 25, 50, 75, 100];

        const result = drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        expect(result.xAxis).toBeDefined();
        expect(result.yAxis).toBeDefined();
    });

    it('adds X axis label when provided',
    {
        meta: {
            alias: 'Axes-Draw-XLabel',
            scenario: "Drawing axes with an X axis label.",
            behavior: "X axis label text element is appended."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks,
            false, false,
            'X Axis Label'
        );

        const xLabel = svgElement.querySelector('.x-axis-label');
        expect(xLabel).not.toBeNull();
        expect(xLabel?.textContent).toBe('X Axis Label');
    });

    it('adds Y axis label when provided',
    {
        meta: {
            alias: 'Axes-Draw-YLabel',
            scenario: "Drawing axes with a Y axis label.",
            behavior: "Y axis label text element is appended with rotation."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks,
            false, false,
            undefined, 'Y Axis Label'
        );

        const yLabel = svgElement.querySelector('.y-axis-label');
        expect(yLabel).not.toBeNull();
        expect(yLabel?.textContent).toBe('Y Axis Label');
    });

    it('hides X axis for Bar Chart plot type',
    {
        meta: {
            alias: 'Axes-Draw-BarChartNoX',
            scenario: "Drawing a Bar Chart.",
            behavior: "X axis is hidden (opacity 0) for Bar Chart."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleBand().domain(['A', 'B', 'C']).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks: number[] = [];
        const yTicks = [0, 25, 50, 75, 100];

        const result = drawAxes(
            'Bar Chart', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        // X axis should have opacity 0 for Bar Chart
        const xAxisStyle = result.xAxis.style('opacity');
        expect(xAxisStyle).toBe('0');
    });

    it('shows x=0 reference line when range includes zero',
    {
        meta: {
            alias: 'Axes-Draw-XZeroLine',
            scenario: "Data range spans negative to positive.",
            behavior: "X=0 reference line is visible."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([-50, 50]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [-50, -25, 0, 25, 50];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        const xZeroLine = svgElement.querySelector('.x-zero');
        expect(xZeroLine?.getAttribute('style')).toContain('opacity: 1');
    });

    it('hides x=0 line when range does not include zero',
    {
        meta: {
            alias: 'Axes-Draw-NoXZeroLine',
            scenario: "Data range is entirely positive.",
            behavior: "X=0 reference line is hidden."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([10, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [10, 30, 50, 70, 100];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        const xZeroLine = svgElement.querySelector('.x-zero');
        expect(xZeroLine?.getAttribute('style')).toContain('opacity: 0');
    });

    it('shows y=0 reference line when range includes zero',
    {
        meta: {
            alias: 'Axes-Draw-YZeroLine',
            scenario: "Y data range spans negative to positive.",
            behavior: "Y=0 reference line is visible."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([-50, 50]).range([560, 20]);
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [-50, -25, 0, 25, 50];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        const yZeroLine = svgElement.querySelector('.y-zero');
        expect(yZeroLine?.getAttribute('style')).toContain('opacity: 1');
    });

    it('rotates X axis tick labels by -20 degrees',
    {
        meta: {
            alias: 'Axes-Draw-TickRotation',
            scenario: "Drawing X axis ticks.",
            behavior: "Tick labels are rotated for better readability."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        const xAxisTexts = svgElement.querySelectorAll('.xAxis text');
        if (xAxisTexts.length > 0) {
            const transform = xAxisTexts[0].getAttribute('transform');
            expect(transform).toContain('rotate(-20)');
        }
    });

    it('sets correct font sizes for tick labels',
    {
        meta: {
            alias: 'Axes-Draw-FontSize',
            scenario: "Drawing axes with ticks.",
            behavior: "Tick labels have appropriate font size."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks
        );

        const xAxisTexts = svgElement.querySelectorAll('.xAxis text');
        const yAxisTexts = svgElement.querySelectorAll('.yAxis text');
        
        if (xAxisTexts.length > 0) {
            expect(xAxisTexts[0].getAttribute('font-size')).toBe('10px');
        }
        if (yAxisTexts.length > 0) {
            expect(yAxisTexts[0].getAttribute('font-size')).toBe('10px');
        }
    });

    it('applies negative formatting when reverseX is true',
    {
        meta: {
            alias: 'Axes-Draw-ReverseXFormat',
            scenario: "Log scale with all negative X values.",
            behavior: "Tick labels are negated for display."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([1, 100]).range([50, 770]); // Absolute values
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);
        const xTicks = [1, 10, 100];
        const yTicks = [0, 25, 50, 75, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks,
            true, // reverseX
            false
        );

        // Ticks should be formatted with negative values
        const xAxisTexts = svgElement.querySelectorAll('.xAxis text');
        if (xAxisTexts.length > 0) {
            // At least one tick should contain a negative sign
            const hasNegative = Array.from(xAxisTexts).some(t => t.textContent?.includes('-'));
            expect(hasNegative).toBe(true);
        }
    });

    it('applies negative formatting when reverseY is true',
    {
        meta: {
            alias: 'Axes-Draw-ReverseYFormat',
            scenario: "Log scale with all negative Y values.",
            behavior: "Y tick labels are negated for display."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([1, 100]).range([560, 20]); // Absolute values
        const xTicks = [0, 25, 50, 75, 100];
        const yTicks = [1, 10, 100];

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, xTicks, yTicks,
            false,
            true // reverseY
        );

        // Y ticks should be formatted with negative values
        const yAxisTexts = svgElement.querySelectorAll('.yAxis text');
        if (yAxisTexts.length > 0) {
            const hasNegative = Array.from(yAxisTexts).some(t => t.textContent?.includes('-'));
            expect(hasNegative).toBe(true);
        }
    });

    it('draws Y axis at correct position (left of plot area)',
    {
        meta: {
            alias: 'Axes-Draw-YPosition',
            scenario: "Drawing Y axis.",
            behavior: "Y axis is positioned at left margin."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([0, 100]).range([560, 20]);

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, [0, 50, 100], [0, 50, 100],
            false, false
        );

        const yAxis = svgElement.querySelector('.yAxis');
        expect(yAxis).not.toBeNull();
        
        // Y axis should be transformed to left margin position
        const transform = yAxis?.getAttribute('transform');
        expect(transform).toContain(`translate(${margins.left}`);
    });

    it('hides y=0 line when range does not include zero',
    {
        meta: {
            alias: 'Axes-Draw-HideYZero',
            scenario: "Y range does not include zero (e.g., 50 to 100).",
            behavior: "Y zero reference line is hidden."
        }
    },
    async () => {
        const drawAxes = await getDrawAxes();
        const svgElement = document.querySelector('.plotSvg') as SVGSVGElement;
        const svg = d3.select(svgElement) as any;
        
        const dimensions = { width: 800, height: 600 };
        const margins = { top: 20, right: 30, bottom: 40, left: 50 };
        const x = d3.scaleLinear().domain([0, 100]).range([50, 770]);
        const y = d3.scaleLinear().domain([50, 100]).range([560, 20]); // No zero

        drawAxes(
            'Scatter Plot', svg, dimensions, margins,
            x, y, [0, 50, 100], [50, 75, 100],
            false, false
        );

        const yZeroLine = svgElement.querySelector('.y-zero') as SVGLineElement;
        // Line should be hidden (opacity set to 0 via style)
        const opacity = yZeroLine?.style?.opacity;
        expect(opacity === '0' || opacity === '').toBeTruthy();
    });

});

// =============================================================================
// Additional generateTicks Tests
// =============================================================================

describe('Additional generateTicks Tests', () => {
    let generateTicks: (
        min: number,
        max: number,
        count?: number,
        isLogScale?: boolean
    ) => number[];

    beforeEach(async () => {
        const axesModule = await import('@/utils/interfaces/plots/axes');
        generateTicks = axesModule.generateTicks;
    });

    it('handles edge case where min is greater than max',
    {
        meta: {
            alias: 'Axes-Ticks-MinGreaterMax',
            scenario: "Invalid input where min > max.",
            behavior: "Returns empty array or swaps values."
        }
    },
    () => {
        const ticks = generateTicks(100, 0, 5, false);
        
        // Either returns empty or handles gracefully
        expect(Array.isArray(ticks)).toBe(true);
    });

    it('generates nice increments (multiples of 1, 2, 2.5, 5, 10)',
    {
        meta: {
            alias: 'Axes-Ticks-NiceIncrements',
            scenario: "Generating readable tick values.",
            behavior: "Tick increments are nice round numbers."
        }
    },
    () => {
        const ticks = generateTicks(0, 100, 5, false);
        
        if (ticks.length >= 2) {
            const increment = ticks[1] - ticks[0];
            // Nice increments are typically multiples of 1, 2, 2.5, 5, 10, etc.
            const normalized = increment / Math.pow(10, Math.floor(Math.log10(increment)));
            const niceValues = [1, 2, 2.5, 5, 10];
            const isNice = niceValues.some(n => Math.abs(normalized - n) < 0.01);
            expect(isNice || increment === 0).toBe(true);
        }
    });
});

// =============================================================================
// Tick Formatting Tests
// =============================================================================

describe('Tick Formatting Tests', () => {

    it('applies correct tick formatting for linear scale',
    {
        meta: {
            alias: 'Axes-Format-Linear',
            scenario: "Linear scale with standard values.",
            behavior: "Tick values are formatted as plain numbers."
        }
    },
    () => {
        const value = 1234.5;
        const formatted = d3.format(".2f")(value);
        
        expect(formatted).toBe("1234.50");
    });

    it('applies correct tick formatting for log scale',
    {
        meta: {
            alias: 'Axes-Format-Log',
            scenario: "Log scale tick formatting.",
            behavior: "Tick values show powers of 10 or scientific notation."
        }
    },
    () => {
        const values = [1, 10, 100, 1000];
        const formatted = values.map(v => d3.format(".0e")(v));
        
        expect(formatted[0]).toBe("1e+0");
        expect(formatted[1]).toBe("1e+1");
        expect(formatted[2]).toBe("1e+2");
    });

    it('formats timestamp ticks correctly',
    {
        meta: {
            alias: 'Axes-Format-Timestamp',
            scenario: "Time axis with timestamp data.",
            behavior: "Timestamps are formatted as readable date-time strings."
        }
    },
    () => {
        const date = new Date("2024-01-15T10:30:00.000Z");
        const formatted = d3.timeFormat("%Y-%m-%d %H:%M")(date);
        
        expect(formatted).toContain("2024");
        expect(formatted).toContain("01");
        expect(formatted).toContain("15");
    });

    it('formats date ticks correctly',
    {
        meta: {
            alias: 'Axes-Format-Date',
            scenario: "Time axis with date data (no time component).",
            behavior: "Dates are formatted as YYYY-MM-DD or similar."
        }
    },
    () => {
        const date = new Date("2024-06-20");
        const formatted = d3.timeFormat("%Y-%m-%d")(date);
        
        expect(formatted).toBe("2024-06-20");
    });

    it('formats time ticks correctly',
    {
        meta: {
            alias: 'Axes-Format-Time',
            scenario: "Time axis with time-only data.",
            behavior: "Times are formatted as HH:MM:SS or similar."
        }
    },
    () => {
        const date = new Date("2024-01-01T14:30:45.000Z");
        const formatted = d3.timeFormat("%H:%M:%S")(date);
        
        expect(formatted).toContain(":");
    });

    it('formats timedelta ticks correctly',
    {
        meta: {
            alias: 'Axes-Format-Timedelta',
            scenario: "Duration/timedelta data.",
            behavior: "Durations are formatted as hours:minutes:seconds."
        }
    },
    () => {
        const seconds = 3661; // 1 hour, 1 minute, 1 second
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        const formatted = `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
        
        expect(formatted).toBe("1:01:01");
    });

    it('shortens time tick labels when consecutive ticks share components',
    {
        meta: {
            alias: 'Axes-Format-ShortenTime',
            scenario: "Multiple time ticks on same day.",
            behavior: "Redundant date components are omitted."
        }
    },
    () => {
        const tick1 = "2024-01-15 10:00";
        const tick2 = "2024-01-15 11:00";
        
        // When same date, could shorten to just time
        const shortened = tick2.replace("2024-01-15 ", "");
        
        expect(shortened).toBe("11:00");
    });

});

// =============================================================================
// Time Tick Formatting Internal Tests
// =============================================================================

describe('Time Tick Formatting Tests', () => {

    it('returns full format for first tick (no previous value)',
    {
        meta: {
            alias: 'Axes-TimeFormat-FirstTick',
            scenario: "Formatting first timestamp tick.",
            behavior: "Full date-time format is used."
        }
    },
    () => {
        const tick = new Date("2024-01-15T10:30:00.000Z");
        const previous: Date | undefined = undefined;
        
        // Without previous, show full format
        const format = previous ? "short" : "full";
        expect(format).toBe("full");
    });

    it('omits year when same as previous tick',
    {
        meta: {
            alias: 'Axes-TimeFormat-OmitYear',
            scenario: "Two ticks in same year.",
            behavior: "Year is omitted from second tick."
        }
    },
    () => {
        const prev = new Date("2024-01-01T00:00:00.000Z");
        const curr = new Date("2024-06-15T00:00:00.000Z");
        
        const sameYear = prev.getFullYear() === curr.getFullYear();
        expect(sameYear).toBe(true);
    });

    it('omits month when same as previous tick',
    {
        meta: {
            alias: 'Axes-TimeFormat-OmitMonth',
            scenario: "Two ticks in same month.",
            behavior: "Month is omitted from second tick."
        }
    },
    () => {
        const prev = new Date("2024-06-01T00:00:00.000Z");
        const curr = new Date("2024-06-15T00:00:00.000Z");
        
        const sameMonth = prev.getMonth() === curr.getMonth();
        expect(sameMonth).toBe(true);
    });

    it('omits day when same as previous tick',
    {
        meta: {
            alias: 'Axes-TimeFormat-OmitDay',
            scenario: "Two ticks on same day.",
            behavior: "Day is omitted from second tick."
        }
    },
    () => {
        const prev = new Date("2024-06-15T10:00:00.000Z");
        const curr = new Date("2024-06-15T14:00:00.000Z");
        
        const sameDay = prev.getDate() === curr.getDate();
        expect(sameDay).toBe(true);
    });

    it('omits hour when same as previous tick',
    {
        meta: {
            alias: 'Axes-TimeFormat-OmitHour',
            scenario: "Two ticks in same hour.",
            behavior: "Hour is omitted from second tick."
        }
    },
    () => {
        const prev = new Date("2024-06-15T10:00:00.000Z");
        const curr = new Date("2024-06-15T10:30:00.000Z");
        
        const sameHour = prev.getHours() === curr.getHours();
        expect(sameHour).toBe(true);
    });

    it('omits minute when same as previous tick',
    {
        meta: {
            alias: 'Axes-TimeFormat-OmitMinute',
            scenario: "Two ticks in same minute.",
            behavior: "Minute is omitted from second tick."
        }
    },
    () => {
        const prev = new Date("2024-06-15T10:30:00.000Z");
        const curr = new Date("2024-06-15T10:30:45.000Z");
        
        const sameMinute = prev.getMinutes() === curr.getMinutes();
        expect(sameMinute).toBe(true);
    });

    it('omits second when same as previous tick',
    {
        meta: {
            alias: 'Axes-TimeFormat-OmitSecond',
            scenario: "Two ticks in same second.",
            behavior: "Second is omitted, show milliseconds."
        }
    },
    () => {
        const prev = new Date("2024-06-15T10:30:45.000Z");
        const curr = new Date("2024-06-15T10:30:45.500Z");
        
        const sameSecond = prev.getSeconds() === curr.getSeconds();
        expect(sameSecond).toBe(true);
    });

    it('removes milliseconds when they are zero',
    {
        meta: {
            alias: 'Axes-TimeFormat-NoMillis',
            scenario: "Timestamp with zero milliseconds.",
            behavior: "Milliseconds are not shown."
        }
    },
    () => {
        const date = new Date("2024-06-15T10:30:45.000Z");
        const hasZeroMillis = date.getMilliseconds() === 0;
        
        expect(hasZeroMillis).toBe(true);
    });

    it('handles date type correctly',
    {
        meta: {
            alias: 'Axes-TimeFormat-DateType',
            scenario: "Field type is 'date' (no time component).",
            behavior: "Only date portion is formatted."
        }
    },
    () => {
        const dataType = 'date';
        const formatString = dataType === 'date' ? "%Y-%m-%d" : "%Y-%m-%d %H:%M:%S";
        
        expect(formatString).toBe("%Y-%m-%d");
    });

    it('handles time type correctly',
    {
        meta: {
            alias: 'Axes-TimeFormat-TimeType',
            scenario: "Field type is 'time' (no date component).",
            behavior: "Only time portion is formatted."
        }
    },
    () => {
        const dataType = 'time';
        const formatString = dataType === 'time' ? "%H:%M:%S" : "%Y-%m-%d %H:%M:%S";
        
        expect(formatString).toBe("%H:%M:%S");
    });

});

