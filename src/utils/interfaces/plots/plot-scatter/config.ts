'use client';

/**
 * Configuration for scatter plot rendering thresholds and behavior
 */
export interface ScatterConfig {
  /** Maximum points for SVG rendering (default: 2000) */
  svgMax: number;

  /** Maximum points for WebGL without sampling (default: 1,000,000) */
  webglMax: number;

  /** Target sample size for datasets > webglMax (default: 500,000) */
  sampleTarget: number;

  /** Enable viewport culling for all render modes (default: true) */
  viewportCulling: boolean;

  /** Hover detection radius in pixels (default: 10) */
  hitThreshold: number;

  /** Default point size in pixels (default: 3) */
  pointSize: number;

  /** Hovered point size in pixels (default: 5) */
  hoverSize: number;

  /** WebGL point size in pixels (default: 5) */
  webglPointSize: number;

  /** WebGL highlighted point size in pixels (default: 10) */
  webglHighlightSize: number;

  /** Grid size for stratified sampling (cells per axis) (default: 50) */
  samplingGridSize: number;

  /** Dimmed point opacity (default: 0.2) */
  dimOpacity: number;

  /** Same-group point opacity when another point is hovered (default: 0.7) */
  sameGroupOpacity: number;
}

/**
 * Default configuration values
 */
const defaultConfig: ScatterConfig = {
  svgMax: 2000,
  webglMax: 1_000_000,
  sampleTarget: 500_000,
  viewportCulling: true,
  hitThreshold: 10,
  pointSize: 3,
  hoverSize: 5,
  webglPointSize: 5,
  webglHighlightSize: 10,
  samplingGridSize: 50,
  dimOpacity: 0.2,
  sameGroupOpacity: 0.7,
};

/**
 * Current active configuration (mutable for testing/customization)
 */
let currentConfig: ScatterConfig = { ...defaultConfig };

/**
 * Get the current scatter plot configuration
 */
export function getConfig(): ScatterConfig {
  return currentConfig;
}

/**
 * Update the scatter plot configuration with partial values
 */
export function updateConfig(partial: Partial<ScatterConfig>): void {
  currentConfig = { ...currentConfig, ...partial };
}

/**
 * Reset configuration to default values
 */
export function resetConfig(): void {
  currentConfig = { ...defaultConfig };
}

/**
 * Get default configuration (for reference)
 */
export function getDefaultConfig(): ScatterConfig {
  return { ...defaultConfig };
}
