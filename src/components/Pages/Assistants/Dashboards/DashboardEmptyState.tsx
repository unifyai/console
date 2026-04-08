import { LayoutDashboard } from 'lucide-react';

export function DashboardEmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <LayoutDashboard className="text-muted-foreground/50 h-10 w-10" />
      <div className="space-y-1">
        <p className="text-label text-foreground">No dashboards yet</p>
        <p className="text-body-muted max-w-[260px]">
          Your assistant will create dashboards during conversations. They&apos;ll appear here
          automatically.
        </p>
      </div>
    </div>
  );
}
