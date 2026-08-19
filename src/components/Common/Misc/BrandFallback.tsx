'use client';

import Link from 'next/link';
import { TeammateCreature } from '@/components/Brand';
import { Button } from '@/components/UI/button';

type BrandFallbackProps = {
  eyebrow: string;
  title: string;
  description: string;
  bubble?: string;
  apology?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function BrandFallback({
  eyebrow,
  title,
  description,
  bubble = 'Looks like this view lost signal.',
  apology,
  actionLabel,
  onAction,
}: BrandFallbackProps) {
  return (
    <main className="brand-fallback-scene flex min-h-screen w-full items-center justify-center overflow-hidden px-6 py-16 text-foreground">
      <section className="brand-fallback-card relative w-full max-w-2xl overflow-hidden text-center">
        <div className="brand-fallback-city-window" aria-hidden />
        <div className="relative grid gap-8 px-6 py-8 sm:px-10 sm:py-10">
          <div className="brand-fallback-hero">
            <span className="brand-fallback-unity">
              <TeammateCreature
                className="h-28 w-28"
                color="green"
                eyes="down"
                label="Sad teammate fallback illustration"
                mood="sad"
                mouthShape="unsure"
                body="short"
              />
            </span>
            <p className="brand-fallback-bubble">{bubble}</p>
          </div>
          <div className="grid gap-4">
            <p className="text-overline">{eyebrow}</p>
            <h1 className="text-brand-heading text-foreground">{title}</h1>
            {apology ? <p className="brand-fallback-apology">{apology}</p> : null}
            <p className="text-body-muted mx-auto max-w-md">{description}</p>
          </div>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            {onAction && actionLabel ? <Button onClick={onAction}>{actionLabel}</Button> : null}
            <Button asChild variant={onAction ? 'outline' : 'default'}>
              <Link href="/">Back to console</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
