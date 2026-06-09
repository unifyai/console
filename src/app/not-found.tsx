import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ErrorImage from '@/public/images/404.png';
import { Button } from '@/components/UI/button';

/**
 * Self-contained 404. Deliberately does NOT use the marketing `Scaffold`
 * (LandingNav + Footer): that chrome carries hosted-Unify sales links
 * (Careers/Contact/Discord invite) which don't belong in a self-host build,
 * and `Scaffold` renders its own <html>/<body>, duplicating the root layout's.
 * Rendering plain content here inherits the root layout's document + theming.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Image src={ErrorImage} alt="" priority className="w-full max-w-md" />
      <div className="space-y-2">
        <h1 className="text-h1 text-semibold">{"Couldn't find what you want"}</h1>
        <p className="text-body-muted">The page may have moved, or the URL might be incorrect.</p>
      </div>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
