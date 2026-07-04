/** Mounts the real UnityCallAvatar in the exact call-window slot markup for
 *  pixel-accurate screenshots of the working (laptop) pose. */
import * as React from 'react';
import { createRoot } from 'react-dom/client';

import { UnityCallAvatar } from '@/components/Pages/Assistants/Communication/UnityCallAvatar';
import type { UnityBody } from '@/components/Brand/unityAppearance';
import type { BrandRole } from '@/components/Brand/shapes';
import type { CreatureAntenna } from '@/components/Brand/TeammateCreature';

// The coordinator (standard teal, no antenna — the look the laptop was tuned
// against) plus each body form with a typical antenna.
const SAMPLES: Array<{
  slug: string;
  body: UnityBody;
  color: BrandRole;
  antenna: CreatureAntenna;
  label: string;
}> = [
  {
    slug: 'standard-teal',
    body: 'standard',
    color: 'teal',
    antenna: 'none',
    label: 'Coordinator (standard / teal / no antenna)',
  },
  {
    slug: 'standard-green',
    body: 'standard',
    color: 'green',
    antenna: 'ball',
    label: 'Medium (standard / green / ball)',
  },
  {
    slug: 'short-orange',
    body: 'short',
    color: 'orange',
    antenna: 'twin',
    label: 'Short (wide / orange / twin)',
  },
  {
    slug: 'tall-pink',
    body: 'tall',
    color: 'pink',
    antenna: 'ball',
    label: 'Tall (tower / pink / ball)',
  },
];

function Slot({
  children,
  slug,
  label,
}: {
  children: React.ReactNode;
  slug: string;
  label: string;
}) {
  // Mirrors AssistantCommunicationMainView's avatar container: h-32 w-32 slot.
  return (
    <figure className="cell" data-slug={slug}>
      <div className="relative-center">
        <div className="slot z-10">{children}</div>
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}

function App() {
  return (
    <main className="board">
      <section>
        <h2>Call-window working pose (laptop-aligned)</h2>
        <div className="grid">
          {SAMPLES.map((s) => (
            <Slot key={s.slug} slug={`cur-${s.slug}`} label={s.label}>
              <UnityCallAvatar
                isSpeaking={false}
                isActing
                alignLaptop
                body={s.body}
                color={s.color}
                antenna={s.antenna}
                label={s.label}
              />
            </Slot>
          ))}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
