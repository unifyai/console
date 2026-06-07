import { TeammateCreature } from '@/components/Brand';

export function DashboardEmptyState() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground"
      data-testid="dashboards-empty"
    >
      <TeammateCreature className="w-20 opacity-90" color="blue" shape="notch" />
      <div className="space-y-1 text-center">
        <p className="text-title text-foreground">No dashboards yet</p>
        <p className="text-caption">
          Ask your teammate to build a view when there is data to track.
        </p>
      </div>
    </div>
  );
}
