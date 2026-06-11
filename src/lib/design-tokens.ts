/**
 * Design Tokens
 *
 * Shared color palette for use in contexts where CSS variables aren't available
 * (e.g., OG image generation, email templates, etc.)
 *
 * These values are derived from src/styles/globals.css and should be kept in sync.
 */

// =============================================================================
// Base Colors (from globals.css)
// =============================================================================

export const baseColors = {
  ink: '#0a1410',
  ink2: '#1a2a23',
  paper: '#f5f1ea',
  paper2: '#ebe6dc',
  rule: '#d9d2c4',
  muted: '#6b6a64',
  creamWhite: '#fffaf1',
  roleGreen: '#2f9d97',
  roleGreenDeep: '#1c6460',
  roleBlue: '#c95f5a',
  roleOrange: '#cf9a3e',
  rolePurple: '#6e4a86',
  roleYellow: '#ffb24a',
  roleTeal: '#3c8f86',
  alertRed: '#d94a3d',
  softAmber: '#c47a00',
  forestGreen: '#1c6460',
  limeGreen: '#2f9d97',
  darkSlateGray: '#1a2a23',
  whiteSmoke: '#f5f1ea',
  eerieBlack: '#0a1410',
  lightNeutralGrey: '#d9d2c4',
  englishViolet: '#6e4a86',
  lavender: '#ded1ff',
  celeste: '#d6f2ef',
} as const;

// =============================================================================
// Dark Theme (used for OG images - always dark for best contrast)
// =============================================================================

export const darkTheme = {
  background: '#0d0f12',
  foreground: '#eef0ea',
  primary: baseColors.roleGreen,
  primaryForeground: baseColors.creamWhite,
  secondary: 'rgba(255, 255, 255, 0.05)',
  muted: 'rgba(255, 255, 255, 0.05)',
  mutedForeground: 'rgba(238, 240, 234, 0.68)',
  border: 'rgba(238, 240, 234, 0.12)',
  destructive: baseColors.alertRed,
  warning: baseColors.softAmber,
} as const;

// =============================================================================
// Light Theme
// =============================================================================

export const lightTheme = {
  background: baseColors.paper,
  foreground: baseColors.ink,
  primary: baseColors.roleGreen,
  primaryForeground: baseColors.creamWhite,
  secondary: baseColors.paper2,
  muted: 'rgba(10, 20, 16, 0.04)',
  mutedForeground: baseColors.muted,
  border: baseColors.rule,
  destructive: baseColors.alertRed,
  warning: baseColors.softAmber,
} as const;

// =============================================================================
// Chart Colors (dark theme - used for OG visualizations)
// =============================================================================

export const chartColors = {
  dark: {
    1: baseColors.roleGreen,
    2: '#7aa7ff',
    3: '#ffad6b',
    4: '#a88cff',
    5: '#ffdb66',
  },
  light: {
    1: baseColors.roleGreenDeep,
    2: baseColors.roleBlue,
    3: baseColors.roleOrange,
    4: baseColors.rolePurple,
    5: baseColors.roleYellow,
  },
} as const;

// =============================================================================
// OG Image Specific (derived from dark theme with adjustments for image context)
// =============================================================================

export const ogColors = {
  // Background gradient (slightly lighter than pure eerieBlack for depth)
  backgroundGradient: `linear-gradient(135deg, #0d0f12 0%, #111714 50%, ${baseColors.ink} 100%)`,

  // Text colors
  title: '#eef0ea',
  subtitle: 'rgba(238, 240, 234, 0.68)',
  muted: baseColors.rule,

  // Primary accent
  primary: baseColors.roleGreen,
  primaryLight: 'rgba(47, 157, 151, 0.2)',
  primaryBorder: 'rgba(47, 157, 151, 0.3)',

  // Table/data colors
  tableHeader: baseColors.roleGreen,
  tableHeaderBg: 'rgba(47, 157, 151, 0.12)',
  tableCellText: '#eef0ea',
  tableCellMuted: 'rgba(238, 240, 234, 0.68)',
  tableBorder: 'rgba(238, 240, 234, 0.12)',
  tableRowAlt: 'rgba(255, 255, 255, 0.02)',

  // Chart colors for OG
  chart: chartColors.dark,

  // Badge/pill
  badge: {
    bg: 'rgba(47, 157, 151, 0.15)',
    border: 'rgba(47, 157, 151, 0.3)',
    text: baseColors.roleGreen,
  },

  // Footer
  brandColor: baseColors.roleGreen,
  footerText: 'rgba(238, 240, 234, 0.46)',
} as const;

// =============================================================================
// Diff Viewer Colors (for react-diff-viewer-continued - requires JS objects)
// =============================================================================

export const diffColors = {
  light: {
    diffViewerBackground: 'transparent',
    diffViewerColor: 'transparent',
    addedBackground: '#e6ffed', // Light green background
    addedColor: '#24292e', // Dark text for light mode
    removedBackground: '#ffeef0', // Light red background
    removedColor: '#24292e', // Dark text for light mode
    wordAddedBackground: '#acf2bd', // Light green for word diff
    wordRemovedBackground: '#fdb8c0', // Light red for word diff
    gutterBackground: 'transparent',
    gutterBackgroundDark: 'transparent',
    emptyLineBackground: 'transparent',
    addedGutterBackground: '#cdffd8', // Light green for gutter
    removedGutterBackground: '#ffdce0', // Light red for gutter
    gutterColor: '#24292e', // Dark text for light mode
    addedGutterColor: '#24292e', // Dark text for light mode
    removedGutterColor: '#24292e', // Dark text for light mode
  },
  dark: {
    diffViewerBackground: 'transparent',
    diffViewerColor: 'transparent',
    addedBackground: '#166534', // Darker green background
    addedColor: baseColors.whiteSmoke, // Light text for dark mode
    removedBackground: '#991b1b', // Darker red background
    removedColor: baseColors.whiteSmoke, // Light text for dark mode
    wordAddedBackground: '#15803d', // Darker green for word diff
    wordRemovedBackground: '#b91c1c', // Darker red for word diff
    gutterBackground: 'transparent',
    gutterBackgroundDark: 'transparent',
    emptyLineBackground: 'transparent',
    addedGutterBackground: '#166534', // Same dark green as content
    removedGutterBackground: '#991b1b', // Same dark red as content
    gutterColor: baseColors.whiteSmoke, // Light text for dark mode
    addedGutterColor: baseColors.whiteSmoke, // Light text for dark mode
    removedGutterColor: baseColors.whiteSmoke, // Light text for dark mode
  },
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type BaseColors = typeof baseColors;
export type Theme = typeof darkTheme;
export type ChartColors = typeof chartColors;
export type OGColors = typeof ogColors;
export type DiffColors = typeof diffColors;
