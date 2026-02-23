/**
 * Open Graph Image Generation for Plot Views
 *
 * Generates a dynamic preview image for social sharing.
 * Uses Next.js ImageResponse (Satori) for image generation.
 * Uses shared fetchPlotData for data fetching (no HTTP roundtrip).
 * Colors derived from src/lib/design-tokens.ts to match app theme.
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { fetchPlotData } from '@/lib/plotData';

// =============================================================================
// Design Tokens (inline - synced with src/lib/design-tokens.ts)
// =============================================================================

const colors = {
  // Base colors from globals.css
  eerieBlack: '#1b1b1b',
  whiteSmoke: '#f5f5f5',
  limeGreen: '#4cc552',
  darkSlateGray: '#2f4f4f',
  lightNeutralGrey: '#b0bec5',

  // Derived colors
  background: '#1b1b1b',
  backgroundGradient: 'linear-gradient(135deg, #1b1b1b 0%, #252525 50%, #2a2a2a 100%)',
  title: '#f5f5f5',
  subtitle: '#b0bec5',
  muted: '#2f4f4f',

  // Primary accent
  primary: '#4cc552',
  primaryLight: 'rgba(76, 197, 82, 0.15)',
  primaryBorder: 'rgba(76, 197, 82, 0.3)',

  // Chart colors (dark theme from globals.css)
  chart: {
    1: '#264cb2', // Blue
    2: '#2db88f', // Teal
    3: '#ef921c', // Orange
    4: '#cb5de8', // Purple
    5: '#eb2483', // Pink
  },

  // Logo green
  logoGreen: '#00B828',
};

// OG Image dimensions (standard for social sharing)
const WIDTH = 1200;
const HEIGHT = 630;

// Shorter timeout for OG generation (5 seconds)
const OG_TIMEOUT_MS = 5000;

/**
 * Unify Logo SVG component for OG images
 */
function UnifyLogo({ height = 20 }: { height?: number }) {
  const scale = height / 20;
  const width = 77 * scale;

  return (
    <svg width={width} height={height} viewBox="0 0 77 20" fill="none" style={{ display: 'flex' }}>
      <path
        d="M24.9941 11.3182V4.90894H28.026V10.9766C28.026 12.5546 28.8703 13.4958 30.2712 13.4958C31.6721 13.4958 32.4992 12.5338 32.4992 10.9766V4.90894H35.5316V11.3182C35.5316 14.3139 33.4432 16.3157 30.2718 16.3157C27.1003 16.3157 24.9947 14.3139 24.9947 11.3182H24.9941Z"
        fill={colors.whiteSmoke}
      />
      <path
        d="M48.4711 9.27922V16.0018H45.4387V9.76473C45.4387 8.08754 44.7948 7.27906 43.4828 7.27906C41.9197 7.27906 40.966 8.38653 40.966 10.1714V16.0013H37.9336V4.90903H40.0139L40.605 6.28031C41.4536 5.28049 42.7942 4.64575 44.3206 4.64575C46.8767 4.64575 48.4705 6.47057 48.4705 9.27922H48.4711Z"
        fill={colors.whiteSmoke}
      />
      <path
        d="M50.9082 4.90893H53.9406V16.0017H50.9082V4.90893ZM50.9136 0.641602H53.9341V3.42999H50.9136V0.641602Z"
        fill={colors.whiteSmoke}
      />
      <path
        d="M63.3443 7.53108H60.5237V16.0018H57.4918V7.53108H55.5488V5.05872H57.5085V4.05411C57.5085 1.93084 58.7111 0.571289 61.0673 0.571289H63.3233V2.93172H61.6751C60.8766 2.93172 60.4439 3.3389 60.4439 4.12873V5.05872H63.3438V7.53108H63.3443Z"
        fill={colors.whiteSmoke}
      />
      <path
        d="M76.2496 4.90894L71.3615 15.8541C70.0172 18.8605 68.8356 19.9999 66.3188 19.9999H65.0688V17.3032H66.1184C67.5802 17.3032 67.9595 16.9184 68.6481 15.2418L68.6907 15.1517L63.9395 4.90894H67.2397L70.2311 11.7328L73.0243 4.90894H76.2491H76.2496Z"
        fill={colors.whiteSmoke}
      />
      <path
        d="M11.6156 0C8.03794 0 5.12676 2.87899 5.12676 6.41831C5.12676 9.2584 7.46249 11.5687 10.3338 11.5687C12.4982 11.5687 14.259 9.82706 14.259 7.6862C14.259 6.24457 13.0731 5.07155 11.6156 5.07155C10.5111 5.07155 9.61288 5.95998 9.61288 7.05252C9.61288 7.79652 10.2228 8.39982 10.975 8.39982C11.0973 8.39982 11.2153 8.38383 11.3279 8.35398C11.1113 8.66843 10.7465 8.87521 10.3338 8.87521C8.96469 8.87521 7.85044 7.77307 7.85044 6.41885C7.85044 4.36539 9.5396 2.69459 11.6156 2.69459C14.3986 2.69459 16.6626 4.93405 16.6626 7.68673C16.6626 11.1386 13.8237 13.9468 10.3338 13.9468C6.13757 13.9468 2.72368 10.57 2.72368 6.41938C2.72368 5.90988 2.76894 5.40358 2.85676 4.9058H0.101296C0.0344837 5.40624 0 5.91148 0 6.41938C0 12.0559 4.63591 16.6414 10.3343 16.6414C15.3259 16.6414 19.3869 12.6245 19.3869 7.68727C19.3863 3.44818 15.9008 0 11.6156 0Z"
        fill={colors.logoGreen}
      />
    </svg>
  );
}

/**
 * Get a display-friendly name for chart types
 */
function getChartTypeName(type: string): string {
  const names: Record<string, string> = {
    line: 'Line Chart',
    bar: 'Bar Chart',
    scatter: 'Scatter Plot',
    histogram: 'Histogram',
    pie: 'Pie Chart',
    area: 'Area Chart',
    heatmap: 'Heatmap',
  };
  return names[type] || 'Chart';
}

/**
 * Get an emoji for chart types
 */
function getChartEmoji(type: string): string {
  const emojis: Record<string, string> = {
    line: '📈',
    bar: '📊',
    scatter: '🔵',
    histogram: '📶',
    pie: '🥧',
    area: '📉',
    heatmap: '🌡️',
  };
  return emojis[type] || '📊';
}

/**
 * Generate a simple bar visualization with app colors
 */
function SimpleBarViz({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const chartColors = [
    colors.chart[1],
    colors.chart[2],
    colors.chart[3],
    colors.chart[4],
    colors.chart[5],
    colors.primary,
  ];

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 12,
        height: 200,
        padding: '20px 40px',
      }}
    >
      {values.slice(0, 8).map((v, i) => (
        <div
          key={i}
          style={{
            width: 80,
            height: `${(v / max) * 160 + 20}px`,
            background: `linear-gradient(to top, ${chartColors[i % chartColors.length]}, ${chartColors[i % chartColors.length]}aa)`,
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 8,
          }}
        >
          <span style={{ color: colors.whiteSmoke, fontSize: 12, fontWeight: 600 }}>
            {v > 1000 ? `${(v / 1000).toFixed(1)}k` : v}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * Generate a simple line visualization with app colors
 */
function SimpleLineViz() {
  const path = 'M 40 160 L 120 100 L 200 130 L 280 60 L 360 90 L 440 40 L 520 70 L 600 30';

  return (
    <svg width="640" height="200" style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="40"
          y1={40 + i * 40}
          x2="600"
          y2={40 + i * 40}
          stroke={colors.muted}
          strokeWidth="1"
          opacity="0.3"
        />
      ))}
      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={colors.primary}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Area under line */}
      <path d={`${path} L 600 180 L 40 180 Z`} fill={colors.primary} opacity="0.15" />
      {/* Points */}
      {[
        [40, 160],
        [120, 100],
        [200, 130],
        [280, 60],
        [360, 90],
        [440, 40],
        [520, 70],
        [600, 30],
      ].map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r="6"
          fill={colors.primary}
          stroke={colors.whiteSmoke}
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}

/**
 * Generate a simple scatter visualization with app colors
 */
function SimpleScatterViz() {
  const points = [
    [60, 140],
    [100, 100],
    [150, 120],
    [200, 80],
    [250, 110],
    [300, 60],
    [350, 90],
    [400, 50],
    [450, 70],
    [500, 40],
    [120, 130],
    [180, 95],
    [280, 75],
    [380, 65],
    [480, 55],
  ];

  const scatterColors = [colors.chart[1], colors.chart[2], colors.primary];

  return (
    <svg width="560" height="180" style={{ overflow: 'visible' }}>
      {/* Grid */}
      <rect
        x="40"
        y="20"
        width="480"
        height="140"
        fill="none"
        stroke={colors.muted}
        strokeWidth="1"
        opacity="0.3"
      />
      {/* Points */}
      {points.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={8 + (i % 3) * 2}
          fill={`${scatterColors[i % scatterColors.length]}80`}
          stroke={scatterColors[i % scatterColors.length]}
          strokeWidth="1"
        />
      ))}
    </svg>
  );
}

/**
 * Generate fallback image when data can't be fetched
 */
function generateFallbackImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: colors.backgroundGradient,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ fontSize: 80, marginBottom: 20 }}>📈</div>
      <div style={{ color: colors.title, fontSize: 48, fontWeight: 600 }}>Plot View</div>
      <div style={{ color: colors.subtitle, fontSize: 24, marginTop: 16 }}>View not available</div>
    </div>,
    { width: WIDTH, height: HEIGHT }
  );
}

export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  console.log('[og/plot] === OG Plot Image Request ===');
  console.log('[og/plot] Raw token from params:', params.token);
  console.log('[og/plot] Request URL:', request.url);
  console.log(
    '[og/plot] Request headers:',
    JSON.stringify(Object.fromEntries(request.headers.entries()), null, 2)
  );

  // Strip .png extension if present (URL can be /api/og/plot/xxx or /api/og/plot/xxx.png)
  const token = params.token.replace(/\.png$/i, '');
  console.log('[og/plot] Cleaned token:', token);

  console.log('[og/plot] Calling fetchPlotData...');
  const startTime = Date.now();
  const result = await fetchPlotData(token, {
    timeoutMs: OG_TIMEOUT_MS,
  });
  const elapsed = Date.now() - startTime;
  console.log(`[og/plot] fetchPlotData completed in ${elapsed}ms`);
  console.log('[og/plot] Result success:', result.success);

  // Fallback image if data can't be fetched
  if (!result.success) {
    console.error('[og/plot] Fetch failed, returning fallback image');
    console.error('[og/plot] Error details:', JSON.stringify(result.error, null, 2));
    return generateFallbackImage();
  }

  console.log('[og/plot] Data fetched successfully, generating image...');

  const { data: plotData } = result;
  const title = plotData.metadata?.title || plotData.config?.title || 'Plot View';
  const projectName = plotData.metadata?.projectName || 'Project';
  const chartType = plotData.config?.type || 'chart';
  const chartTypeName = getChartTypeName(chartType);
  const chartEmoji = getChartEmoji(chartType);
  const dataPoints = plotData.data?.length || 0;
  const xAxis = plotData.config?.xAxis;
  const yAxis = plotData.config?.yAxis;

  // Extract numeric values for bar chart visualization
  // Priority: 1) preAggregatedBarData, 2) raw y-axis values from data
  let numericValues: number[] = [];

  // Try to get pre-aggregated bar data first (most accurate for bar charts)
  if (plotData.preAggregatedBarData && Array.isArray(plotData.preAggregatedBarData)) {
    if (!plotData.isGroupedBarChart) {
      // Ungrouped: [[label, value], ...]
      const ungrouped = plotData.preAggregatedBarData as [string, number][];
      numericValues = ungrouped.slice(0, 8).map(([, v]) => v);
    } else {
      // Grouped: [[groupKey, [label, value]], ...]
      const grouped = plotData.preAggregatedBarData as [string, [string, number]][];
      numericValues = grouped.slice(0, 8).map(([, labelValue]) => labelValue[1]);
    }
  }

  // Fallback: try raw y-axis values
  if (numericValues.length === 0 && plotData.data && yAxis) {
    plotData.data.slice(0, 8).forEach((row) => {
      const val = row[yAxis];
      if (typeof val === 'number') numericValues.push(val);
    });
  }

  // No data? Show empty state (don't use fake data)
  const hasRealData = numericValues.length > 0;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: colors.backgroundGradient,
        fontFamily: 'system-ui, sans-serif',
        padding: 48,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: colors.title,
              fontSize: 42,
              fontWeight: 700,
              marginBottom: 8,
              maxWidth: 800,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </div>
          <div
            style={{ color: colors.subtitle, fontSize: 22, display: 'flex', alignItems: 'center' }}
          >
            <span style={{ marginRight: 16 }}>{projectName}</span>
            <span style={{ color: colors.muted }}>•</span>
            <span style={{ marginLeft: 16 }}>{dataPoints.toLocaleString()} data points</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 16px',
            background: colors.primaryLight,
            borderRadius: 8,
            border: `1px solid ${colors.primaryBorder}`,
          }}
        >
          <span style={{ color: colors.primary, fontSize: 18, fontWeight: 500 }}>
            {chartEmoji} {chartTypeName}
          </span>
        </div>
      </div>

      {/* Chart Preview */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: 12,
          border: `1px solid rgba(47, 79, 79, 0.5)`,
          overflow: 'hidden',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {/* Render different chart visualizations based on type */}
        {(chartType === 'bar' || chartType === 'histogram') && hasRealData ? (
          <SimpleBarViz values={numericValues.slice(0, 8)} />
        ) : (chartType === 'bar' || chartType === 'histogram') && !hasRealData ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.muted,
              fontSize: 18,
              padding: 40,
            }}
          >
            <span style={{ fontSize: 48, marginBottom: 16 }}>📊</span>
            <span>No numeric data to visualize</span>
          </div>
        ) : chartType === 'scatter' ? (
          <SimpleScatterViz />
        ) : (
          <SimpleLineViz />
        )}

        {/* Axis labels */}
        {(xAxis || yAxis) && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 32,
              padding: '16px 24px',
              color: colors.muted,
              fontSize: 14,
            }}
          >
            {xAxis && (
              <span>
                X: <span style={{ color: colors.primary }}>{xAxis}</span>
              </span>
            )}
            {yAxis && (
              <span>
                Y: <span style={{ color: colors.primary }}>{yAxis}</span>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 24,
        }}
      >
        <div style={{ color: colors.muted, fontSize: 16 }}>
          Click to view interactive visualization
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <UnifyLogo height={24} />
        </div>
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
    }
  );
}
