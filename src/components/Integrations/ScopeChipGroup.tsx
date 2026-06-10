'use client';

import { Badge } from '@/components/UI/badge';
import type { IntegrationScope } from '@/types/integrations';

export function ScopeChipGroup({
  scopes,
  limit = 4,
  emptyLabel = 'No scopes required',
}: {
  scopes: IntegrationScope[];
  limit?: number;
  emptyLabel?: string;
}) {
  if (scopes.length === 0) {
    return <p className="text-caption">{emptyLabel}</p>;
  }

  const visible = scopes.slice(0, limit);
  const remaining = scopes.length - visible.length;

  return (
    <div className="flex flex-wrap gap-1.5" data-testid="integration-scope-chips">
      {visible.map((scope) => (
        <Badge
          key={scope.id}
          variant="secondary"
          className="rounded-full bg-muted text-muted-foreground"
        >
          {scope.label}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          +{remaining} more
        </Badge>
      )}
    </div>
  );
}
