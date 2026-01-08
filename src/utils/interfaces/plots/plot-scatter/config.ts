'use client';

/**
 * Configuration for scatter plot rendering thresholds and behavior
 */
export interface ScatterConfig {
  /** Maximum points for SVG rendering (default: 2000) */
  SVG_MAX: number;

  /** Maximum points for WebGL without sampling (default: 1,000,000) */
  WEBGL_MAX: number;

  /** Target sample size for datasets > WEBGL_MAX (default: 500,000) */
  SAMPLE_TARGET: number;

  /** Enable viewport culling for all render modes (default: true) */
  VIEWPORT_CULLING: boolean;

  /** Hover detection radius in pixels (default: 10) */
  HIT_THRESHOLD: number;

  /** Default point size in pixels (default: 3) */
  POINT_SIZE: number;

  /** Hovered point size in pixels (default: 5) */
  HOVER_SIZE: number;

  /** WebGL point size in pixels (default: 5) */
  WEBGL_POINT_SIZE: number;

  /** WebGL highlighted point size in pixels (default: 10) */
  WEBGL_HIGHLIGHT_SIZE: number;

  /** Grid size for stratified sampling (cells per axis) (default: 50) */
  SAMPLING_GRID_SIZE: number;

  /** Dimmed point opacity (default: 0.2) */
  DIM_OPACITY: number;

  /** Same-group point opacity when another point is hovered (default: 0.7) */
  SAME_GROUP_OPACITY: number;
}

/**
 * Default configuration values
 */
const defaultConfig: ScatterConfig = {
  SVG_MAX: 2000,
  WEBGL_MAX: 1_000_000,
  SAMPLE_TARGET: 500_000,
  VIEWPORT_CULLING: true,
  HIT_THRESHOLD: 10,
  POINT_SIZE: 3,
  HOVER_SIZE: 5,
  WEBGL_POINT_SIZE: 5,
  WEBGL_HIGHLIGHT_SIZE: 10,
  SAMPLING_GRID_SIZE: 50,
  DIM_OPACITY: 0.2,
  SAME_GROUP_OPACITY: 0.7,
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
