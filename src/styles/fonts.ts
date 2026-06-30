/**
 * Canonical brand fonts, sourced from `@unity/brand/fonts` (local font files).
 *
 * The brand package exposes the fonts under their own CSS variable names
 * (`--font-inter`, `--font-space-grotesk`, `--font-roboto-mono`,
 * `--font-instrument-serif`). Console references `--font-sans`, `--font-mono`,
 * and `--font-serif`; those are aliased to the brand variables in
 * `globals.css`. The names below are kept stable so existing importers
 * (`layout.tsx`, `Scaffold.tsx`) continue to work unchanged.
 */
export {
  inter as fontSans,
  spaceGrotesk as fontSpaceGrotesk,
  robotoMono as fontMono,
  instrumentSerif as fontSerif,
  brandFontVariables,
} from '@unity/brand/fonts';
