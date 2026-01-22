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
  forestGreen: '#2a862a',
  limeGreen: '#4cc552',
  darkSlateGray: '#2f4f4f',
  whiteSmoke: '#f5f5f5',
  eerieBlack: '#1b1b1b',
  lightNeutralGrey: '#b0bec5',
  alertRed: '#e53935',
  softAmber: '#f6a623',
  englishViolet: '#5c415d',
  lavender: '#b39ddb',
  celeste: '#bcf4f5',
} as const;

// =============================================================================
// Dark Theme (used for OG images - always dark for best contrast)
// =============================================================================

export const darkTheme = {
  background: baseColors.eerieBlack,
  foreground: baseColors.whiteSmoke,
  primary: baseColors.limeGreen,
  primaryForeground: baseColors.eerieBlack,
  secondary: baseColors.celeste,
  muted: baseColors.darkSlateGray,
  mutedForeground: baseColors.lightNeutralGrey,
  border: baseColors.darkSlateGray,
  destructive: baseColors.alertRed,
  warning: baseColors.softAmber,
} as const;

// =============================================================================
// Light Theme
// =============================================================================

export const lightTheme = {
  background: baseColors.whiteSmoke,
  foreground: baseColors.eerieBlack,
  primary: baseColors.forestGreen,
  primaryForeground: baseColors.whiteSmoke,
  secondary: baseColors.lavender,
  muted: baseColors.lightNeutralGrey,
  mutedForeground: baseColors.darkSlateGray,
  border: baseColors.lightNeutralGrey,
  destructive: baseColors.alertRed,
  warning: baseColors.softAmber,
} as const;

// =============================================================================
// Chart Colors (dark theme - used for OG visualizations)
// =============================================================================

export const chartColors = {
  dark: {
    1: '#264cb2', // Blue
    2: '#2db88f', // Teal
    3: '#ef921c', // Orange
    4: '#cb5de8', // Purple
    5: '#eb2483', // Pink
  },
  light: {
    1: '#e8623c', // Orange-red
    2: '#2aa096', // Teal
    3: '#274654', // Dark teal
    4: '#f3c45a', // Yellow
    5: '#f2ab35', // Amber
  },
} as const;

// =============================================================================
// OG Image Specific (derived from dark theme with adjustments for image context)
// =============================================================================

export const ogColors = {
  // Background gradient (slightly lighter than pure eerieBlack for depth)
  backgroundGradient: `linear-gradient(135deg, ${baseColors.eerieBlack} 0%, #252525 50%, #2a2a2a 100%)`,

  // Text colors
  title: baseColors.whiteSmoke,
  subtitle: baseColors.lightNeutralGrey,
  muted: baseColors.darkSlateGray,

  // Primary accent (lime green)
  primary: baseColors.limeGreen,
  primaryLight: 'rgba(76, 197, 82, 0.2)', // limeGreen with alpha
  primaryBorder: 'rgba(76, 197, 82, 0.3)',

  // Table/data colors
  tableHeader: baseColors.limeGreen,
  tableHeaderBg: 'rgba(76, 197, 82, 0.1)',
  tableCellText: baseColors.whiteSmoke,
  tableCellMuted: baseColors.lightNeutralGrey,
  tableBorder: 'rgba(47, 79, 79, 0.5)', // darkSlateGray with alpha
  tableRowAlt: 'rgba(255, 255, 255, 0.02)',

  // Chart colors for OG
  chart: chartColors.dark,

  // Badge/pill
  badge: {
    bg: 'rgba(76, 197, 82, 0.15)',
    border: 'rgba(76, 197, 82, 0.3)',
    text: baseColors.limeGreen,
  },

  // Footer
  brandColor: baseColors.limeGreen,
  footerText: baseColors.darkSlateGray,
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type BaseColors = typeof baseColors;
export type Theme = typeof darkTheme;
export type ChartColors = typeof chartColors;
export type OGColors = typeof ogColors;
