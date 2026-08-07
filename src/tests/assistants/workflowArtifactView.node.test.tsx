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

  it('says plainly when nothing is published for an item', () => {
    renderInDrawer(
      <WorkflowArtifactView
        artifact={{ ...artifact, body: '' }}
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByText(/Nothing published for this item yet/)).toBeInTheDocument();
  });
});
