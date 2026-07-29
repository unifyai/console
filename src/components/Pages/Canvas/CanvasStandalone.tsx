'use client';

/**
 * Full-page chrome for one canvas.
 *
 * The title and description are drawn here rather than by the canvas, so what
 * names a view is console's and cannot be restyled or faked from inside the frame.
 * `<Canvas title>` is deliberately not a prop in the kit for the same reason.
 */

import * as React from 'react';

import { CanvasView } from '@/components/Canvas/CanvasView';
import type { CanvasPayload } from '@/lib/client/canvasView';

export function CanvasStandalone({ token }: { token: string }) {
  const [canvas, setCanvas] = React.useState<CanvasPayload | null>(null);

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8">
        {canvas ? (
          <header className="flex flex-col gap-1">
            <h1 className="text-heading text-foreground">{canvas.title}</h1>
            {canvas.description ? (
              <p className="text-body text-muted-foreground">{canvas.description}</p>
            ) : null}
          </header>
        ) : null}

        <CanvasView token={token} onLoaded={setCanvas} />
      </div>
    </main>
  );
}
