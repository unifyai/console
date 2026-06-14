'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type TeleportMode = 'in' | 'out';

const DEFAULT_DURATION_MS = 700;

/**
 * Wraps a droid (or any content) in a sci-fi "teleport" dissolve: the content
 * shatters into a coarse, pixelated scatter and fades. ``out`` dematerialises
 * (solid → gone) where the droid currently is; ``in`` materialises (gone →
 * solid) where it reappears. Pairing an ``out`` at one spot with an ``in`` at
 * another reads as a teleport rather than a flight.
 *
 * The dissolve is an SVG ``feTurbulence`` → ``feDisplacementMap`` filter driven
 * by SMIL, so it animates on the compositor with no per-frame React work. The
 * noise is quantised into discrete bands so the scatter breaks into chunky,
 * pixelated blocks instead of a smooth smear.
 *
 * The filter is only attached while the effect runs:
 *  - ``out`` freezes on the fully-dissolved frame and stays attached until the
 *    parent unmounts the element, so the droid stays gone.
 *  - ``in`` detaches once finished, handing back the untouched droid.
 */
export function DroidTeleportFizzle({
  mode,
  active = true,
  durationMs = DEFAULT_DURATION_MS,
  className,
  children,
}: {
  mode: TeleportMode;
  /** Drives the ``out`` dissolve (e.g. flip true on landing). ``in`` runs on
   *  mount, so leave this at its default. */
  active?: boolean;
  durationMs?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const reactId = React.useId().replace(/:/g, '');
  const filterId = `droid-teleport-${mode}-${reactId}`;
  const [running, setRunning] = React.useState(active);

  React.useEffect(() => {
    if (!active) {
      setRunning(false);
      return;
    }
    setRunning(true);
    // ``out`` holds on the dissolved frame until the parent unmounts the droid;
    // ``in`` releases the filter once the droid has fully materialised so the
    // live avatar renders without a lingering filter.
    if (mode !== 'in') return undefined;
    const handle = window.setTimeout(() => setRunning(false), durationMs);
    return () => window.clearTimeout(handle);
  }, [active, durationMs, mode]);

  const durSec = `${(durationMs / 1000).toFixed(3)}s`;
  // ``out``: solid → scattered + transparent. ``in``: the reverse.
  const freqValues = mode === 'out' ? '0.035;0.5' : '0.5;0.035';
  const scaleValues = mode === 'out' ? '0;64' : '64;0';
  const alphaValues = mode === 'out' ? '1;0' : '0;1';
  const startFreq = mode === 'out' ? 0.035 : 0.5;
  const startScale = mode === 'out' ? 0 : 64;
  const startAlpha = mode === 'out' ? 1 : 0;

  return (
    <div
      className={cn('relative', className)}
      style={running ? { filter: `url(#${filterId})` } : undefined}
    >
      {running && (
        <svg
          aria-hidden="true"
          width="0"
          height="0"
          className="pointer-events-none absolute h-0 w-0"
        >
          <defs>
            <filter
              id={filterId}
              x="-75%"
              y="-75%"
              width="250%"
              height="250%"
              colorInterpolationFilters="sRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency={startFreq}
                numOctaves={2}
                seed={7}
                stitchTiles="stitch"
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  dur={durSec}
                  values={freqValues}
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.4 0 0.2 1"
                  fill="freeze"
                />
              </feTurbulence>
              {/* Quantise the noise so the scatter breaks into chunky,
               * pixelated blocks rather than a smooth smear. */}
              <feComponentTransfer in="noise" result="blocks">
                <feFuncR type="discrete" tableValues="0 0.25 0.5 0.75 1" />
                <feFuncG type="discrete" tableValues="0 0.25 0.5 0.75 1" />
              </feComponentTransfer>
              <feDisplacementMap
                in="SourceGraphic"
                in2="blocks"
                xChannelSelector="R"
                yChannelSelector="G"
                scale={startScale}
                result="displaced"
              >
                <animate
                  attributeName="scale"
                  dur={durSec}
                  values={scaleValues}
                  calcMode="spline"
                  keyTimes="0;1"
                  keySplines="0.4 0 0.2 1"
                  fill="freeze"
                />
              </feDisplacementMap>
              <feComponentTransfer in="displaced">
                <feFuncA type="linear" slope={startAlpha}>
                  <animate attributeName="slope" dur={durSec} values={alphaValues} fill="freeze" />
                </feFuncA>
              </feComponentTransfer>
            </filter>
          </defs>
        </svg>
      )}
      {children}
    </div>
  );
}
