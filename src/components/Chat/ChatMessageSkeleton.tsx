import { cn } from '@/lib/utils';

/**
 * Skeleton loaders shaped like chat message bubbles.
 * Shown while transcript history is being fetched, giving
 * users an immediate sense of the chat layout.
 *
 * Uses bg-muted instead of the default Skeleton's bg-primary-tint-10
 * because the primary color at 10% opacity is nearly invisible
 * against the chat background in both light and dark themes.
 */

function Bar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} style={style} />;
}

function AssistantMessageSkeleton({ lineWidths }: { lineWidths: string[] }) {
  return (
    <div className="min-w-0 md:max-w-[55%]">
      {/* Avatar + name row */}
      <div className="mb-2.5 flex items-center gap-2">
        <Bar className="h-6 w-6 flex-shrink-0 rounded-full" />
        <Bar className="h-3 w-24" />
        <Bar className="h-2.5 w-10" />
      </div>
      {/* Message body lines */}
      <div className="space-y-2">
        {lineWidths.map((w, i) => (
          <Bar key={i} className="h-3.5" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}

function UserMessageSkeleton({ width }: { width: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] md:max-w-[55%]">
        <Bar className="h-10 rounded-lg" style={{ width }} />
      </div>
    </div>
  );
}

export function ChatMessageSkeletons() {
  return (
    <div className="space-y-6 px-3 py-4" style={{ width: '100%' }} data-testid="chat-skeleton">
      {/* Simulate a short conversation: assistant → user → assistant */}
      <AssistantMessageSkeleton lineWidths={['85%', '70%']} />
      <UserMessageSkeleton width="40%" />
      <AssistantMessageSkeleton lineWidths={['90%', '80%', '45%']} />
      <UserMessageSkeleton width="55%" />
      <AssistantMessageSkeleton lineWidths={['75%', '60%']} />
    </div>
  );
}
