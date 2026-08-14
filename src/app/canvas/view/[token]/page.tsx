/**
 * Standalone canvas page.
 *
 * Holding the token is not by itself permission
 * to read: `/api/canvas/[token]` authenticates the viewer and checks the canvas's
 * visibility before any bytes are served, and this page renders whatever that
 * route decides — including its refusal.
 *
 * The metadata is deliberately generic. Resolving the real title here would mean
 * reading it before any viewer has been authenticated, which would leak the titles
 * of private and team canvases to anyone holding a link. Rich metadata belongs with
 * the per-canvas `public_link` opt-in, where being publicly readable is the
 * author's explicit choice; until then the title is rendered client-side, after the
 * viewer has been authorized.
 */

import { Metadata } from 'next';

import { CanvasStandalone } from '@/components/Pages/Canvas/CanvasStandalone';

export const metadata: Metadata = {
  title: 'Canvas',
  description: 'An interactive view built by your assistant.',
  robots: { index: false, follow: false },
};

export default async function CanvasViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <CanvasStandalone token={token} />;
}
