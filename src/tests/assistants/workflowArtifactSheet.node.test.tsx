// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkflowArtifactSheet } from '@/components/Workflows/WorkflowArtifactSheet';
import type { WorkflowArtifact } from '@/types/workflows';

/**
 * The in-place preview: a nested sheet above the workflow drawer so reading
 * a bundled artifact never means leaving the install flow. Back returns to
 * the drawer; the tab link is a secondary affordance inside the preview.
 */

const artifact: WorkflowArtifact = {
  contentKey: 'daily-briefing/tasks/db/morning',
  slug: 'daily-briefing',
  kind: 'tasks',
  name: 'Daily briefing',
  body: 'Compose and deliver the **morning briefing**.',
  schedule: 'Every weekday at 08:30',
  meta: {},
};

describe('WorkflowArtifactSheet', () => {
  it('renders the artifact body as markdown, with its kind and schedule', () => {
    render(
      <WorkflowArtifactSheet artifact={artifact} open onBack={() => {}} onNavigate={() => {}} />
    );

    expect(screen.getByTestId('workflow-artifact-sheet')).toBeInTheDocument();
    expect(screen.getByText('Daily briefing')).toBeInTheDocument();
    expect(screen.getByText(/lives in Tasks/)).toBeInTheDocument();
    expect(screen.getByText('Every weekday at 08:30')).toBeInTheDocument();
    // Markdown rendered, not raw asterisks.
    expect(screen.getByText('morning briefing')).toBeInTheDocument();
  });

  it('goes back to the drawer, and opens the rail section as a secondary action', () => {
    const onBack = vi.fn();
    const onNavigate = vi.fn();
    render(
      <WorkflowArtifactSheet artifact={artifact} open onBack={onBack} onNavigate={onNavigate} />
    );

    fireEvent.click(screen.getByTestId('workflow-artifact-back'));
    expect(onBack).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('workflow-artifact-open-section'));
    expect(onNavigate).toHaveBeenCalledWith('tasks');
  });

  it('says plainly when nothing is published for an item', () => {
    render(
      <WorkflowArtifactSheet
        artifact={{ ...artifact, body: '' }}
        open
        onBack={() => {}}
        onNavigate={() => {}}
      />
    );
    expect(screen.getByText(/Nothing published for this item yet/)).toBeInTheDocument();
  });
});
