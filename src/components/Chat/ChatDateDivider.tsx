function formatDateDivider(date: Date, timezone?: string | null): string {
  const now = new Date();
  const tzOpts: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};
  const dateFmt = new Intl.DateTimeFormat('en-CA', {
    ...tzOpts,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const dateStr = dateFmt.format(date);
  const todayStr = dateFmt.format(now);

  const yesterday = new Date(now.getTime() - 86_400_000);
  const yesterdayStr = dateFmt.format(yesterday);

  if (dateStr === todayStr) return 'Today';
  if (dateStr === yesterdayStr) return 'Yesterday';

  return new Intl.DateTimeFormat('en-US', {
    ...tzOpts,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

export function isSameDay(a: Date, b: Date, timezone?: string | null): boolean {
  const tzOpts: Intl.DateTimeFormatOptions = timezone ? { timeZone: timezone } : {};
  const fmt = new Intl.DateTimeFormat('en-CA', {
    ...tzOpts,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(a) === fmt.format(b);
}

interface ChatDateDividerProps {
  date: Date;
  timezone?: string | null;
}

export function ChatDateDivider({ date, timezone }: ChatDateDividerProps) {
  return (
    <div className="flex items-center justify-center py-2">
      <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
        {formatDateDivider(date, timezone)}
      </span>
    </div>
  );
}
