'use client';

import { Badge } from '@/components/UI/badge';
import type { IntegrationCapabilityGroup } from '@/types/integrations';

export function CapabilityGroupList({ groups }: { groups: IntegrationCapabilityGroup[] }) {
  if (groups.length === 0) {
    return (
      <div className="bg-muted/20 rounded-lg border p-3">
        <p className="text-caption">
          Capabilities will appear here once Orchestra sends overlay metadata.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="integration-capability-groups">
      {groups.map((group) => (
        <div key={group.id} className="rounded-lg border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-title text-sm">{group.label}</h4>
              {group.description && <p className="text-caption mt-1">{group.description}</p>}
            </div>
            {group.toolIds && group.toolIds.length > 0 && (
              <Badge variant="outline" className="shrink-0 rounded-full text-muted-foreground">
                {group.toolIds.length} tools
              </Badge>
            )}
          </div>
          {group.policyLabels && group.policyLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {group.policyLabels.map((label) => (
                <Badge
                  key={label}
                  variant="secondary"
                  className="rounded-full bg-muted text-muted-foreground"
                >
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
