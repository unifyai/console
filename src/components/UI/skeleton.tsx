import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // A clearly-perceptible neutral tint (ink/paper foreground at low alpha) so the
  // loading shimmer reads against every surface in both themes — a faint accent
  // tint disappears on the cream paper background and the placeholder looks like
  // an empty box rather than an animated loader.
  return (
    <div className={cn('bg-foreground/[0.09] animate-pulse rounded-md', className)} {...props} />
  );
}

export { Skeleton };
