import { Send } from 'lucide-react';
import type { RequestSentAck } from '@/types/assistants/chat';

function formatAckTime(date: Date, timezone?: string | null): string | null {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  if (timezone) options.timeZone = timezone;
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

interface RequestSentAckBubbleProps {
  ack: RequestSentAck;
  timezone?: string | null;
}

export function RequestSentAckBubble({ ack, timezone }: RequestSentAckBubbleProps) {
  const timeStr = formatAckTime(ack.timestamp, timezone);

  return (
    <div className="flex items-center justify-center py-1.5" data-testid="request-sent-ack">
      <div
        className="bg-muted/40 border-border/80 flex max-w-[min(100%,28rem)] items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] leading-snug text-muted-foreground"
        data-testid="request-sent-ack-label"
      >
        <Send className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
        <span>
          <span className="text-foreground/80 font-medium">Request sent:</span>{' '}
          <span className="text-foreground/70">{ack.label}</span>
        </span>
        {timeStr && <time className="shrink-0 text-[10px] opacity-60">{timeStr}</time>}
      </div>
    </div>
  );
}
