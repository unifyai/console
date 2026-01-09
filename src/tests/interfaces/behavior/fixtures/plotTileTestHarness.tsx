/**
 * Plot Tile Test Harness
 * 
 * A reusable wrapper for testing plot/chart visualization behaviors
 * including axis selection, plot type changes, and settings.
 * 
 * IMPROVED: Uses REAL Zustand store and hooks (`usePlotTile`).
 */
import React, { useState, useCallback, useEffect } from 'react';
import { render, RenderResult } from '@testing-library/react';
import { Settings, Maximize2, X } from 'lucide-react';

// Real Store Imports
import { StoreProvider, useStoreApiContext, useStoreContext } from '../../../../contexts/providers/StoreProvider';
import { usePlotTile } from '../../../../contexts/hooks/tile/usePlotTile';
import { initTile, Tile } from '../../../../contexts/slices/selectors/tile';
import { initPlotTile, PlotTile } from '../../../../contexts/slices/selectors/plotTile';
import { initTab } from '../../../../contexts/slices/selectors/tab';
import { IStoreState } from '../../../../contexts/store';

// =============================================================================
// Types
// =============================================================================

export type PlotType = 'scatter' | 'line' | 'bar' | 'histogram';

export interface DataPoint {
  x: number;
  y: number;
  label?: string;
  category?: string;
}

export type ScaleType = 'linear' | 'log';

export interface PlotTileCallbacks {
  onXAxisChange?: (column: string) => void;
  onYAxisChange?: (column: string) => void;
  onPlotTypeChange?: (type: PlotType) => void;
  onColorByChange?: (column: string | null) => void;
  onSettingsToggle?: (open: boolean) => void;
  onFocusModeToggle?: (focused: boolean) => void;
  onScaleXChange?: (scale: ScaleType) => void;
  onScaleYChange?: (scale: ScaleType) => void;
  onZoomChange?: (enabled: boolean) => void;
  onRegressionChange?: (show: boolean) => void;
  onBinCountChange?: (count: number) => void;
}

export interface PlotTileTestOptions {
  /** Initial data points */
  initialData?: DataPoint[];
  /** Available columns for axis selection */
  columns?: string[];
  /** Initial X axis column */
  initialXAxis?: string;
  /** Initial Y axis column */
  initialYAxis?: string;
  /** Initial plot type */
  initialPlotType?: PlotType;
  /** Initial color by column */
  initialColorBy?: string | null;
  /** Initial settings panel state */
  initialSettingsOpen?: boolean;
  /** Initial focus mode state */
  initialFocusMode?: boolean;
  /** Callbacks for actions */
  callbacks?: PlotTileCallbacks;
  /** Initial X scale type */
  initialScaleX?: ScaleType;
  /** Initial Y scale type */
  initialScaleY?: ScaleType;
  /** Initial zoom enabled state */
  initialZoomEnabled?: boolean;
  /** Initial regression line visibility */
  initialShowRegression?: boolean;
  /** Initial bin count for histogram */
  initialBinCount?: number;
}

export interface PlotTileTestResult extends RenderResult {
  /** Get current X axis column */
  getXAxis: () => string;
  /** Get current Y axis column */
  getYAxis: () => string;
  /** Get current plot type */
  getPlotType: () => PlotType;
  /** Get current color by column */
  getColorBy: () => string | null;
  /** Check if settings panel is open */
  isSettingsOpen: () => boolean;
  /** Check if focus mode is active */
  isFocusMode: () => boolean;
  /** Set X axis column */
  setXAxis: (column: string) => void;
  /** Set Y axis column */
  setYAxis: (column: string) => void;
  /** Set plot type */
  setPlotType: (type: PlotType) => void;
  /** Set color by column */
  setColorBy: (column: string | null) => void;
  /** Toggle settings panel */
  toggleSettings: () => void;
  /** Toggle focus mode */
  toggleFocusMode: () => void;
  /** Get X scale type */
  getScaleX: () => ScaleType;
  /** Get Y scale type */
  getScaleY: () => ScaleType;
  /** Set X scale type */
  setScaleX: (scale: ScaleType) => void;
  /** Set Y scale type */
  setScaleY: (scale: ScaleType) => void;
  /** Check if zoom is enabled */
  isZoomEnabled: () => boolean;
  /** Toggle zoom */
  toggleZoom: () => void;
  /** Check if regression line is shown */
  isRegressionShown: () => boolean;
  /** Toggle regression line */
  toggleRegression: () => void;
  /** Get bin count */
  getBinCount: () => number;
  /** Set bin count */
  setBinCount: (count: number) => void;
}

// =============================================================================
// Mock Data
// =============================================================================

export function createMockPlotData(count: number = 20): DataPoint[] {
  const categories = ['A', 'B', 'C'];
  return Array.from({ length: count }, (_, i) => ({
    x: i * 10 + Math.random() * 5,
    y: Math.random() * 100,
    label: `Point ${i + 1}`,
    category: categories[i % categories.length],
  }));
}

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  getXAxis: () => string;
  getYAxis: () => string;
  getPlotType: () => PlotType;
  getColorBy: () => string | null;
  isSettingsOpen: () => boolean;
  isFocusMode: () => boolean;
  setXAxis: (column: string) => void;
  setYAxis: (column: string) => void;
  setPlotType: (type: PlotType) => void;
  setColorBy: (column: string | null) => void;
  toggleSettings: () => void;
  toggleFocusMode: () => void;
  getScaleX: () => ScaleType;
  getScaleY: () => ScaleType;
  setScaleX: (scale: ScaleType) => void;
  setScaleY: (scale: ScaleType) => void;
  isZoomEnabled: () => boolean;
  toggleZoom: () => void;
  isRegressionShown: () => boolean;
  toggleRegression: () => void;
  getBinCount: () => number;
  setBinCount: (count: number) => void;
}

// =============================================================================
// Constants
// =============================================================================

const TAB_ID = 'test-tab';
const TILE_ID = 'test-plot-tile';

// =============================================================================
// Plot Tile Inner Component (Connected to Store)
// =============================================================================

interface PlotTileInnerProps extends PlotTileTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function PlotTileInner({
  initialData,
  columns = ['x', 'y', 'score', 'timestamp', 'category'],
  initialSettingsOpen = false,
  initialFocusMode = false,
  initialScaleX = 'linear',
  initialScaleY = 'linear',
  initialZoomEnabled = false,
  initialShowRegression = false,
  initialBinCount = 10,
  callbacks = {},
  stateContainerRef,
}: PlotTileInnerProps) {
  // Access store via hooks
  const { plotTile, plotTileActions, exists } = usePlotTile(TILE_ID, TAB_ID);
  const storeUpdateTile = useStoreContext(state => state.updateTile);
  
  // Local state for UI things not yet in store (or mocked for this test)
  const [data] = useState<DataPoint[]>(initialData ?? createMockPlotData());
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [focusMode, setFocusMode] = useState(initialFocusMode);
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const [scaleX, setScaleX] = useState<ScaleType>(initialScaleX);
  const [scaleY, setScaleY] = useState<ScaleType>(initialScaleY);
  const [zoomEnabled, setZoomEnabled] = useState(initialZoomEnabled);
  const [showRegression, setShowRegression] = useState(initialShowRegression);
  const [binCount, setBinCount] = useState(initialBinCount);
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleSetXAxis = useCallback((column: string) => {
    plotTileActions?.setXAxis(column);
    callbacks.onXAxisChange?.(column);
  }, [plotTileActions, callbacks]);

  const handleSetYAxis = useCallback((column: string) => {
    plotTileActions?.setYAxis(column);
    callbacks.onYAxisChange?.(column);
  }, [plotTileActions, callbacks]);

  const handleSetPlotType = useCallback((type: PlotType) => {
    plotTileActions?.setPlotType(type);
    callbacks.onPlotTypeChange?.(type);
  }, [plotTileActions, callbacks]);

  const handleSetColorBy = useCallback((column: string | null) => {
    plotTileActions?.setPlotGroupBy(column ?? undefined);
    callbacks.onColorByChange?.(column);
  }, [plotTileActions, callbacks]);

  const handleToggleSettings = useCallback(() => {
    setSettingsOpen((prev) => {
      const newValue = !prev;
      callbacks.onSettingsToggle?.(newValue);
      return newValue;
    });
  }, [callbacks]);

  const handleToggleFocusMode = useCallback(() => {
    setFocusMode((prev) => {
      const newValue = !prev;
      callbacks.onFocusModeToggle?.(newValue);
      return newValue;
    });
  }, [callbacks]);

  const handleSetScaleX = useCallback((scale: ScaleType) => {
    setScaleX(scale);
    callbacks.onScaleXChange?.(scale);
  }, [callbacks]);

  const handleSetScaleY = useCallback((scale: ScaleType) => {
    setScaleY(scale);
    callbacks.onScaleYChange?.(scale);
  }, [callbacks]);

  const handleToggleZoom = useCallback(() => {
    setZoomEnabled((prev) => {
      const newValue = !prev;
      callbacks.onZoomChange?.(newValue);
      if (!newValue) {
        // Reset zoom transform when disabling
        setZoomTransform({ k: 1, x: 0, y: 0 });
      }
      return newValue;
    });
  }, [callbacks]);

  const handleToggleRegression = useCallback(() => {
    setShowRegression((prev) => {
      const newValue = !prev;
      callbacks.onRegressionChange?.(newValue);
      return newValue;
    });
  }, [callbacks]);

  const handleSetBinCount = useCallback((count: number) => {
    setBinCount(count);
    callbacks.onBinCountChange?.(count);
  }, [callbacks]);

  // ==========================================================================
  // Expose state to test via ref
  // ==========================================================================

  useEffect(() => {
    stateContainerRef.current = {
      getXAxis: () => plotTile?.xAxis || '',
      getYAxis: () => plotTile?.yAxis || '',
      getPlotType: () => (plotTile?.plotType as PlotType) || 'scatter',
      getColorBy: () => plotTile?.plotGroupBy || null,
      isSettingsOpen: () => settingsOpen,
      isFocusMode: () => focusMode,
      setXAxis: handleSetXAxis,
      setYAxis: handleSetYAxis,
      setPlotType: handleSetPlotType,
      setColorBy: handleSetColorBy,
      toggleSettings: handleToggleSettings,
      toggleFocusMode: handleToggleFocusMode,
      getScaleX: () => scaleX,
      getScaleY: () => scaleY,
      setScaleX: handleSetScaleX,
      setScaleY: handleSetScaleY,
      isZoomEnabled: () => zoomEnabled,
      toggleZoom: handleToggleZoom,
      isRegressionShown: () => showRegression,
      toggleRegression: handleToggleRegression,
      getBinCount: () => binCount,
      setBinCount: handleSetBinCount,
    };
  });

  if (!stateContainerRef.current) {
    // Initial mock state before store is ready/accessed
    stateContainerRef.current = {
      getXAxis: () => '',
      getYAxis: () => '',
      getPlotType: () => 'scatter',
      getColorBy: () => null,
      isSettingsOpen: () => settingsOpen,
      isFocusMode: () => focusMode,
      setXAxis: handleSetXAxis,
      setYAxis: handleSetYAxis,
      setPlotType: handleSetPlotType,
      setColorBy: handleSetColorBy,
      toggleSettings: handleToggleSettings,
      toggleFocusMode: handleToggleFocusMode,
      getScaleX: () => scaleX,
      getScaleY: () => scaleY,
      setScaleX: handleSetScaleX,
      setScaleY: handleSetScaleY,
      isZoomEnabled: () => zoomEnabled,
      toggleZoom: handleToggleZoom,
      isRegressionShown: () => showRegression,
      toggleRegression: handleToggleRegression,
      getBinCount: () => binCount,
      setBinCount: handleSetBinCount,
    };
  }

  // Wait for store to initialize
  if (!exists || !plotTile) {
    return <div>Loading...</div>;
  }

  // ==========================================================================
  // Render helpers
  // ==========================================================================

  const getPointColor = (point: DataPoint) => {
    if (!plotTile.plotGroupBy) return '#3b82f6';
    const colors = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b'];
    const index = point.category ? ['A', 'B', 'C', 'D'].indexOf(point.category) : 0;
    return colors[index % colors.length];
  };

  // ==========================================================================
  // Render
  // ==========================================================================

  const plotContent = (
    <div
      data-testid="plot-tile-container"
      className={`bg-white border rounded-lg ${focusMode ? 'fixed inset-4 z-50' : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className="font-semibold">Plot</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleToggleSettings}
            className={`p-1 rounded ${settingsOpen ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
            data-testid="settings-button"
            aria-pressed={settingsOpen}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={handleToggleFocusMode}
            className="p-1 rounded hover:bg-gray-100"
            data-testid="focus-mode-button"
          >
            {focusMode ? <X className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Plot area */}
        <div className="flex-1 p-4">
          {/* Simulated chart */}
          <div
            className="relative w-full h-64 bg-gray-50 border rounded"
            data-testid="plot-canvas"
            data-plot-type={plotTile.plotType || 'scatter'}
          >
            {/* Y axis label */}
            <div
              className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs text-gray-500"
              data-testid="y-axis-label"
            >
              {plotTile.yAxis}
            </div>

            {/* X axis label */}
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-gray-500"
              data-testid="x-axis-label"
            >
              {plotTile.xAxis}
            </div>

            {/* Data points */}
            <svg 
              className="w-full h-full" 
              data-testid="plot-svg"
              data-zoom-enabled={zoomEnabled}
              data-scale-x={scaleX}
              data-scale-y={scaleY}
            >
              {/* Zoom container */}
              <g 
                data-testid="zoom-container"
                transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${zoomTransform.k})`}
              >
                {/* Scatter plot points */}
                {(plotTile.plotType === 'scatter' || !plotTile.plotType) && data.map((point, i) => (
                  <circle
                    key={i}
                    cx={`${(point.x / 200) * 100}%`}
                    cy={`${100 - (point.y / 100) * 100}%`}
                    r={hoveredPoint === point ? 8 : 6}
                    fill={getPointColor(point)}
                    opacity={hoveredPoint && hoveredPoint !== point ? 0.3 : 1}
                    className="cursor-pointer transition-all"
                    data-testid={`data-point-${i}`}
                    data-point-label={point.label}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
                
                {/* Regression line (for scatter) */}
                {showRegression && (plotTile.plotType === 'scatter' || !plotTile.plotType) && (
                  <g data-testid="regression-group">
                    <line
                      x1="10%"
                      y1="80%"
                      x2="90%"
                      y2="20%"
                      stroke="#ef4444"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                      data-testid="regression-line"
                    />
                    <text
                      x="75%"
                      y="30%"
                      fontSize="10"
                      fill="#ef4444"
                      data-testid="regression-text"
                    >
                      r = 0.85
                    </text>
                  </g>
                )}
                
                {/* Line chart */}
                {plotTile.plotType === 'line' && (
                  <polyline
                    points={data.map((p) => 
                      `${(p.x / 200) * 100}%,${100 - (p.y / 100) * 100}%`
                    ).join(' ')}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    data-testid="line-path"
                  />
                )}
                
                {/* Bar chart */}
                {plotTile.plotType === 'bar' && data.slice(0, 10).map((point, i) => (
                  <rect
                    key={i}
                    x={`${i * 10}%`}
                    y={`${100 - point.y}%`}
                    width="8%"
                    height={`${point.y}%`}
                    fill={getPointColor(point)}
                    opacity={hoveredPoint && hoveredPoint !== point ? 0.3 : 1}
                    data-testid={`bar-${i}`}
                    onMouseEnter={() => setHoveredPoint(point)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                ))}
                
                {/* Histogram */}
                {plotTile.plotType === 'histogram' && Array.from({ length: binCount }, (_, i) => {
                  const binHeight = Math.random() * 80 + 10;
                  return (
                    <rect
                      key={i}
                      x={`${(i / binCount) * 100}%`}
                      y={`${100 - binHeight}%`}
                      width={`${90 / binCount}%`}
                      height={`${binHeight}%`}
                      fill="#3b82f6"
                      opacity={0.8}
                      data-testid={`histogram-bin-${i}`}
                      onMouseEnter={() => setHoveredPoint({ x: i, y: binHeight, label: `Bin ${i + 1}` })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </g>
            </svg>

            {/* Tooltip */}
            {hoveredPoint && (
              <div
                className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none"
                style={{ left: '50%', top: '10px' }}
                data-testid="tooltip"
              >
                {hoveredPoint.label}: ({hoveredPoint.x.toFixed(1)}, {hoveredPoint.y.toFixed(1)})
              </div>
            )}

            {/* Legend (when color by is set) */}
            {plotTile.plotGroupBy && (
              <div
                className="absolute top-2 right-2 bg-white border rounded p-2 text-xs"
                data-testid="legend"
              >
                <div className="font-semibold mb-1">{plotTile.plotGroupBy}</div>
                {['A', 'B', 'C'].map((cat, i) => (
                  <div key={cat} className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: ['#ef4444', '#22c55e', '#3b82f6'][i] }}
                    />
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <div
            className="w-64 border-l p-4"
            data-testid="settings-panel"
          >
            <h4 className="font-semibold mb-4">Settings</h4>

            {/* X Axis */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">X Axis</label>
              <select
                value={plotTile.xAxis || ''}
                onChange={(e) => handleSetXAxis(e.target.value)}
                className="w-full border rounded px-2 py-1"
                data-testid="x-axis-select"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Y Axis */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Y Axis</label>
              <select
                value={plotTile.yAxis || ''}
                onChange={(e) => handleSetYAxis(e.target.value)}
                className="w-full border rounded px-2 py-1"
                data-testid="y-axis-select"
              >
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* Plot Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Plot Type</label>
              <select
                value={plotTile.plotType || 'scatter'}
                onChange={(e) => handleSetPlotType(e.target.value as PlotType)}
                className="w-full border rounded px-2 py-1"
                data-testid="plot-type-select"
              >
                <option value="scatter">Scatter</option>
                <option value="line">Line</option>
                <option value="bar">Bar</option>
                <option value="histogram">Histogram</option>
              </select>
            </div>

            {/* Color By */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Color By</label>
              <select
                value={plotTile.plotGroupBy || ''}
                onChange={(e) => handleSetColorBy(e.target.value || null)}
                className="w-full border rounded px-2 py-1"
                data-testid="color-by-select"
              >
                <option value="">None</option>
                {columns.map((col) => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>

            {/* X Scale (for scatter/line) */}
            {(plotTile.plotType === 'scatter' || plotTile.plotType === 'line' || !plotTile.plotType) && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">X Scale</label>
                <select
                  value={scaleX}
                  onChange={(e) => handleSetScaleX(e.target.value as ScaleType)}
                  className="w-full border rounded px-2 py-1"
                  data-testid="scale-x-select"
                >
                  <option value="linear">Linear</option>
                  <option value="log">Log</option>
                </select>
              </div>
            )}

            {/* Y Scale (for scatter/line) */}
            {(plotTile.plotType === 'scatter' || plotTile.plotType === 'line' || !plotTile.plotType) && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Y Scale</label>
                <select
                  value={scaleY}
                  onChange={(e) => handleSetScaleY(e.target.value as ScaleType)}
                  className="w-full border rounded px-2 py-1"
                  data-testid="scale-y-select"
                >
                  <option value="linear">Linear</option>
                  <option value="log">Log</option>
                </select>
              </div>
            )}

            {/* Zoom Toggle (for scatter/line) */}
            {(plotTile.plotType === 'scatter' || plotTile.plotType === 'line' || !plotTile.plotType) && (
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={zoomEnabled}
                    onChange={handleToggleZoom}
                    className="rounded"
                    data-testid="zoom-toggle"
                  />
                  <span className="text-sm font-medium">Enable Zoom</span>
                </label>
              </div>
            )}

            {/* Regression Toggle (for scatter) */}
            {(plotTile.plotType === 'scatter' || !plotTile.plotType) && (
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showRegression}
                    onChange={handleToggleRegression}
                    className="rounded"
                    data-testid="regression-toggle"
                  />
                  <span className="text-sm font-medium">Show Regression</span>
                </label>
              </div>
            )}

            {/* Bin Count (for histogram) */}
            {plotTile.plotType === 'histogram' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  Bin Count: <span data-testid="bin-count-value">{binCount}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={50}
                  value={binCount}
                  onChange={(e) => handleSetBinCount(parseInt(e.target.value, 10))}
                  className="w-full"
                  data-testid="bin-count-slider"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Render focus mode overlay
  if (focusMode) {
    return (
      <>
        <div className="fixed inset-0 bg-black/50 z-40" data-testid="focus-overlay" />
        {plotContent}
      </>
    );
  }

  return plotContent;
}

// =============================================================================
// Main Export: renderPlotTile
// =============================================================================

/**
 * Creates initial store state with a plot tile
 */
function createInitialStoreState(options: PlotTileTestOptions): Partial<IStoreState> {
  const {
    initialXAxis = 'x',
    initialYAxis = 'y',
    initialPlotType = 'scatter',
    initialColorBy = null,
  } = options;

  const tab = initTab(TAB_ID, { name: 'Test Tab', tileIds: [TILE_ID] });
  
  const plotTileData: Partial<PlotTile> = {
    xAxis: initialXAxis,
    yAxis: initialYAxis,
    plotType: initialPlotType,
    plotGroupBy: initialColorBy,
  };

  const tile = initTile(TILE_ID, {
    type: 'Plot',
    tabId: TAB_ID,
    visible: true,
    plotTile: initPlotTile(plotTileData)
  });

  return {
    activeTabId: TAB_ID,
    tabsById: {
      [TAB_ID]: tab
    },
    tilesById: {
      [TILE_ID]: tile
    }
  };
}

export function renderPlotTile(options: PlotTileTestOptions = {}): PlotTileTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  const initialState = createInitialStoreState(options);

  const renderResult = render(
    <StoreProvider initialState={initialState}>
      <PlotTileInner {...options} stateContainerRef={stateContainerRef} />
    </StoreProvider>
  );

  return {
    ...renderResult,
    getXAxis: () => stateContainerRef.current?.getXAxis() ?? '',
    getYAxis: () => stateContainerRef.current?.getYAxis() ?? '',
    getPlotType: () => stateContainerRef.current?.getPlotType() ?? 'scatter',
    getColorBy: () => stateContainerRef.current?.getColorBy() ?? null,
    isSettingsOpen: () => stateContainerRef.current?.isSettingsOpen() ?? false,
    isFocusMode: () => stateContainerRef.current?.isFocusMode() ?? false,
    setXAxis: (column) => stateContainerRef.current?.setXAxis(column),
    setYAxis: (column) => stateContainerRef.current?.setYAxis(column),
    setPlotType: (type) => stateContainerRef.current?.setPlotType(type),
    setColorBy: (column) => stateContainerRef.current?.setColorBy(column),
    toggleSettings: () => stateContainerRef.current?.toggleSettings(),
    toggleFocusMode: () => stateContainerRef.current?.toggleFocusMode(),
    getScaleX: () => stateContainerRef.current?.getScaleX() ?? 'linear',
    getScaleY: () => stateContainerRef.current?.getScaleY() ?? 'linear',
    setScaleX: (scale) => stateContainerRef.current?.setScaleX(scale),
    setScaleY: (scale) => stateContainerRef.current?.setScaleY(scale),
    isZoomEnabled: () => stateContainerRef.current?.isZoomEnabled() ?? false,
    toggleZoom: () => stateContainerRef.current?.toggleZoom(),
    isRegressionShown: () => stateContainerRef.current?.isRegressionShown() ?? false,
    toggleRegression: () => stateContainerRef.current?.toggleRegression(),
    getBinCount: () => stateContainerRef.current?.getBinCount() ?? 10,
    setBinCount: (count) => stateContainerRef.current?.setBinCount(count),
  };
}

export { createMockPlotData as createMockData };
