'use client';

import * as React from 'react';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/UI/alert-dialog';
import { Badge } from '@/components/UI/badge';
import { Checkbox } from '@/components/UI/checkbox';
import { Label } from '@/components/UI/label';
import { ScrollArea } from '@/components/UI/scroll-area';
import { WORKFLOW_SURFACES, WORKFLOW_SURFACE_ORDER } from './workflowCategories';
import type { WorkflowGalleryItem } from '@/types/workflows';

/**
 * Recurring jobs silently ceasing is worse than an error, so this dialog names
 * every job that stops firing, by name and schedule, before anything else.
 *
 * The "keep the data" checkbox is a deliberate addition to the brief: a stored
 * table holds the user's rows, not the workflow's. Deleting it is not symmetric
 * with removing a procedure, so it is opt-in and defaults to keeping.
 */
export function UninstallWorkflowDialog({
  item,
  open,
  onOpenChange,
  onConfirm,
}: {
  item: WorkflowGalleryItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (options: { keepData: boolean }) => void;
}) {
  const [keepData, setKeepData] = React.useState(true);
  React.useEffect(() => setKeepData(true), [item?.workflow.slug]);

  if (!item?.installation) return null;
  const { workflow, installation } = item;
  const removed = WORKFLOW_SURFACE_ORDER.filter(
    (kind) => kind !== 'tasks' && (workflow.sets[kind]?.length ?? 0) > 0
  );
  const tables = workflow.sets.tables ?? [];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid={`uninstall-workflow-${workflow.slug}`}>
        <AlertDialogHeader>
          <AlertDialogTitle>Uninstall {workflow.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {installation.destination.kind === 'team'
              ? `This is a team install — it comes off the shared assistant for all ${installation.destination.memberCount} members.`
              : 'This removes it from your assistant.'}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <ScrollArea
          className="max-h-[52vh]"
          viewportClassName="min-w-0 overflow-x-hidden [&>div]:!block"
        >
          <div className="flex flex-col gap-4 pr-1">
            <div className="border-destructive/30 rounded-xl border bg-[color:var(--status-danger-bg)] p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-destructive">
                These stop firing
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {installation.tasks.map((task) => {
                  const schedule = workflow.sets.tasks?.find(
                    (entry) => entry.name === task.name
                  )?.schedule;
                  return (
                    <li key={task.taskId} className="text-sm">
                      {task.name}
                      <span className="text-caption block">
                        {schedule} · {task.enabled ? 'currently armed' : 'currently held'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div>
              <p className="text-caption">Also removed:</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {removed.map((kind) => (
                  <Badge
                    key={kind}
                    variant="outline"
                    className="rounded-lg font-normal text-muted-foreground"
                  >
                    {workflow.sets[kind]?.length} {WORKFLOW_SURFACES[kind].label.toLowerCase()}
                  </Badge>
                ))}
              </div>
              {(workflow.sets.functions?.length ?? 0) > 0 && (
                <p className="text-caption mt-2">
                  Functions another installed workflow still uses are kept until the last workflow
                  using them is removed.
                </p>
              )}
            </div>

            {tables.length > 0 && (
              <div className="flex items-start gap-2.5 rounded-xl border bg-card-2 p-3">
                <Checkbox
                  id="workflow-keep-data"
                  checked={keepData}
                  onCheckedChange={(checked) => setKeepData(checked === true)}
                  className="mt-0.5"
                />
                <Label htmlFor="workflow-keep-data" className="font-normal leading-snug">
                  Keep the data it collected
                  <span className="text-caption mt-0.5 block">
                    {tables.map((table) => table.name).join(', ')} stays in Data. Uncheck to delete
                    the rows too — that can&rsquo;t be undone.
                  </span>
                </Label>
              </div>
            )}
          </div>
        </ScrollArea>

        <AlertDialogFooter>
          <AlertDialogCancel>Keep it installed</AlertDialogCancel>
          <AlertDialogAction
            className="hover:bg-destructive/90 gap-1.5 bg-destructive text-destructive-foreground"
            onClick={() => onConfirm({ keepData })}
          >
            <Trash2 className="h-4 w-4" />
            Uninstall
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
