/** Parity page: the classic overlay composition (billboard Laptop absolutely
 *  positioned over the droid) next to the in-scene laptop, rendered statically
 *  (fixed pose, fixed face, key animation disabled) so the two can be
 *  pixel-diffed. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import '@unity/brand/laptop.css';
import {
  Laptop,
  RotatingBot,
  getCreatureAccent,
  getDroidBodyForm,
  getRotatingBotSlotLiftPx,
} from '@unity/brand/components';
import type { BrandRole } from '@/components/Brand/shapes';
import type { UnityBody } from '@/components/Brand/unityAppearance';
import type { CreatureAntenna } from '@/components/Brand/TeammateCreature';

const CAMERA_VIEW = { yaw: 0, tilt: 7 } as const;
const WORKING_VIEW = { yaw: 45, tilt: 30 } as const;
const SLOT_PX = 128;

// The tuned classic-overlay profiles (pre-world-space console values).
const OVERLAY_PROFILES = {
  default: { left: '85%', top: '91%', width: '90%' },
  wide: { left: '80%', top: '93.1%', width: '68%' },
} as const;

const SAMPLES: Array<{
  slug: string;
  body: UnityBody;
  color: BrandRole;
  antenna: CreatureAntenna;
}> = [
  { slug: 'standard-teal', body: 'standard', color: 'teal', antenna: 'none' },
  { slug: 'standard-green', body: 'standard', color: 'green', antenna: 'ball' },
  { slug: 'short-orange', body: 'short', color: 'orange', antenna: 'twin' },
  { slug: 'tall-pink', body: 'tall', color: 'pink', antenna: 'ball' },
];

function Cell({
  sample,
  variant,
}: {
  sample: (typeof SAMPLES)[number];
  variant: 'classic' | 'inscene';
}) {
  const form = getDroidBodyForm(sample.body);
  const lift = getRotatingBotSlotLiftPx(form, SLOT_PX, {
    pose: 1,
    restView: CAMERA_VIEW,
    activeView: WORKING_VIEW,
    antenna: sample.antenna,
  });
  const profile = form === 'wide' ? OVERLAY_PROFILES.wide : OVERLAY_PROFILES.default;

  const bot = (
    <RotatingBot
      accent={getCreatureAccent(sample.color)}
      antenna={sample.antenna}
      eyeDir="down"
      fixed={1}
      form={form}
      mouth="closed"
      restView={CAMERA_VIEW}
      activeView={WORKING_VIEW}
      laptop={variant === 'inscene' ? { fold: 0 } : undefined}
    />
  );

  return (
    <figure className="cell" data-slug={`${variant}-${sample.slug}`}>
      <div className="slot">
        <span className="working">
          <span
            className="lift"
            // Match production exactly: no transform at all when the lift is
            // zero (a translateY(0) still creates a compositing layer, which
            // paint-snaps its contents by up to one device pixel).
            style={lift !== 0 ? { transform: `translateY(${lift.toFixed(2)}px)` } : undefined}
          >
            {bot}
          </span>
          {variant === 'classic' && (
            <span
              style={{
                position: 'absolute',
                ...profile,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              <Laptop fold={0} />
            </span>
          )}
        </span>
      </div>
      <figcaption>
        {variant} / {sample.slug}
      </figcaption>
    </figure>
  );
}

function App() {
  return (
    <main className="board">
      {(['classic', 'inscene'] as const).map((variant) => (
        <section key={variant}>
          <h2>{variant === 'classic' ? 'Classic overlay (original)' : 'In-scene (new)'}</h2>
          <div className="grid">
            {SAMPLES.map((sample) => (
              <Cell key={sample.slug} sample={sample} variant={variant} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
