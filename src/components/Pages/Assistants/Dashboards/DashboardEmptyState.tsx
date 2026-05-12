export function DashboardEmptyState() {
  return (
    <div
      className="flex h-full items-center justify-center text-muted-foreground"
      data-testid="dashboards-empty"
    >
      <p className="text-sm">No dashboards found</p>
    </div>
  );
}
