import { Phone, PhoneMissed } from 'lucide-react';
import { CallPill as CallPillType } from '@/types/assistants/chat';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `0:${String(seconds).padStart(2, '0')}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatPillTime(date: Date, timezone?: string | null): string | null {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };
  if (timezone) options.timeZone = timezone;
  return new Intl.DateTimeFormat('en-GB', options).format(date);
}

interface CallPillProps {
  pill: CallPillType;
  timezone?: string | null;
  /**
   * Opens the call transcript. Omit for human-to-human calls, which carry no
   * transcript and render as a static, duration-only pill.
   */
  onClick?: (pill: CallPillType) => void;
}

export function CallPillBubble({ pill, timezone, onClick }: CallPillProps) {
  const timeStr = formatPillTime(pill.timestamp, timezone);
  const label = pill.missed ? 'Missed call' : `Call ${formatDuration(pill.durationSeconds)}`;
  const Icon = pill.missed ? PhoneMissed : Phone;

  const content = (
    <>
      <Icon className="h-3 w-3" />
      <span>{label}</span>
      {timeStr && <time className="text-[10px] opacity-60">{timeStr}</time>}
    </>
  );

  const baseClass =
    'bg-muted/60 flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground';

  return (
    <div className="flex items-center justify-center py-1.5" data-testid="call-pill">
      {onClick ? (
        <button
          type="button"
          onClick={() => onClick(pill)}
          className={`${baseClass} transition-colors hover:bg-muted hover:text-foreground`}
          data-testid="call-pill-button"
          data-call-id={pill.callId ?? ''}
        >
          {content}
        </button>
      ) : (
        <div className={baseClass} data-testid="call-pill-static" data-call-id={pill.callId ?? ''}>
          {content}
        </div>
      )}
    </div>
  );
}
