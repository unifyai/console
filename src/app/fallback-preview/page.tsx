'use client';

import { BrandFallback } from '@/components/Common/Misc/BrandFallback';

export default function FallbackPreviewPage() {
  return (
    <BrandFallback
      actionLabel="Try again"
      apology="Sorry about that. We're working on a fix now."
      bubble="Looks like this view lost signal."
      description="The console hit a snag while loading this view. Try again, or head back to the console while the droid resets."
      eyebrow="System hiccup"
      onAction={() => window.location.reload()}
      title="A droid tripped over a loose cable"
    />
  );
}
