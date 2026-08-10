// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { Sheet, SheetContent } from '@/components/UI/sheet';
import { WorkflowArtifactView } from '@/components/Workflows/WorkflowArtifactView';
import type { WorkflowArtifact } from '@/types/workflows';

/**
 * The in-place preview: a nested sheet above the workflow drawer so reading
 * a bundled artifact never means leaving the install flow. Back returns to
 * the drawer; the tab link is a secondary affordance inside the preview.
 */

/** The panel owns the drawer's title while previewing, so it needs the drawer. */
function renderInDrawer(ui: React.ReactNode) {
  return render(
    <Sheet open>
      <SheetContent>{ui}</SheetContent>
    </Sheet>
  );
}

const artifact: WorkflowArtifact = {
  contentKey: 'daily-briefing/tasks/db/morning',
  slug: 'daily-briefing',
  kind: 'tasks',
  name: 'Daily briefing',
  body: 'Compose and deliver the **morning briefing**.',
  schedule: 'Every weekday at 08:30',
  meta: {},
};

describe('WorkflowArtifactView', () => {
  it('renders the artifact body as markdown, with its kind and schedule', () => {
    renderInDrawer(
      <WorkflowArtifactView artifact={artifact} onBack={() => {}} onNavigate={() => {}} />
    );

    expect(screen.getByTestId('workflow-artifact-view')).toBeInTheDocument();
    expect(screen.getByText('Daily briefing')).toBeInTheDocument();
    expect(screen.getByText(/lives in Tasks/)).toBeInTheDocument();
    expect(screen.getByText('Every weekday at 08:30')).toBeInTheDocument();
    // Markdown rendered, not raw asterisks.
    expect(screen.getByText('morning briefing')).toBeInTheDocument();
  });

  it('goes back to the drawer, and opens the rail section as a secondary action', () => {
    const onBack = vi.fn();
    const onNavigate = vi.fn();
    renderInDrawer(
      <WorkflowArtifactView artifact={artifact} onBack={onBack} onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByTestId('workflow-artifact-back'));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('workflow-artifact-open-section'));
    expect(onNavigate).toHaveBeenCalledWith('tasks');
  });

  it('renders a function as its own page does, from the published meta', () => {
    // The point of the preview: the same signature block, badges and copy
    // affordance the Functions tab shows — not a retelling of them.
    renderInDrawer(
      <WorkflowArtifactView
        artifact={{
          ...artifact,
          kind: 'functions',
          name: 'briefing_window',
          body: 'The exact time window a morning briefing should scan.',
          schedule: undefined,
          meta: {
            language: 'python',
            argspec: "(now_iso: 'str | None' = None) -> 'dict'",
            verify: true,
            implementation: 'def briefing_window():\n    return {}',
          },
        }}
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(screen.getByTestId('function-detail-body')).toBeInTheDocument();
    expect(screen.getByTestId('function-badges')).toBeInTheDocument();
    expect(screen.getByText('Signature')).toBeInTheDocument();
    expect(screen.getByTestId('function-copy')).toBeInTheDocument();
  });

  it('renders a task with the same field grid and run history the tab shows', () => {
    renderInDrawer(
      <WorkflowArtifactView
        artifact={{
          ...artifact,
          kind: 'tasks',
          meta: { repeat: [{ frequency: 'daily' }], priority: 'normal', tags: ['x'] },
        }}
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(screen.getByTestId('workflow-artifact-task')).toBeInTheDocument();
    expect(screen.getByTestId('task-fields')).toBeInTheDocument();
    // Pre-install there is genuinely nothing to inspect, and the native empty
    // state says so rather than the preview inventing one.
    expect(screen.getByText('No runs recorded yet.')).toBeInTheDocument();
  });

  it('shows a claim with its kind and topics', () => {
    renderInDrawer(
      <WorkflowArtifactView
        artifact={{
          ...artifact,
          kind: 'knowledge',
          schedule: undefined,
          meta: { kind: 'definition', topics: ['commitments'] },
        }}
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(screen.getByTestId('workflow-artifact-claim')).toBeInTheDocument();
    expect(screen.getByText('definition')).toBeInTheDocument();
    expect(screen.getByText('commitments')).toBeInTheDocument();
  });

  it('says plainly when nothing is published, for a kind with no native view', () => {
    // A table needs live rows, so there is no native view a preview could
    // mirror — it keeps the prose body.
    renderInDrawer(
      <WorkflowArtifactView
        artifact={{ ...artifact, kind: 'tables', schedule: undefined, body: '' }}
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByText(/Nothing published for this item yet/)).toBeInTheDocument();
  });

  it('describes a canvas rather than showing its source', () => {
    // The one artifact whose substance is not what a reader wants: raw TSX is
    // noise for someone deciding whether to install, and the shelf never
    // publishes view.tsx at all.
    renderInDrawer(
      <WorkflowArtifactView
        artifact={{
          ...artifact,
          kind: 'canvases',
          name: 'Sourcing funnel',
          schedule: undefined,
          body: 'A live funnel of every prospect this workflow sourced.',
          meta: { binds_to: ['sourced_leads'], actions: ['export_csv'] },
        }}
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );

    expect(screen.getByTestId('workflow-artifact-canvas')).toBeInTheDocument();
    expect(screen.getByText(/live funnel of every prospect/)).toBeInTheDocument();
    expect(screen.getByText('sourced_leads')).toBeInTheDocument();
    expect(screen.getByText('export_csv')).toBeInTheDocument();
    // Never a signature block or implementation — that is a function's view.
    expect(screen.queryByTestId('function-detail-body')).not.toBeInTheDocument();
  });
});
