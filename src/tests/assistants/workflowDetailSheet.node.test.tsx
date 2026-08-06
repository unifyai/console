// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { WorkflowDetailSheet } from '@/components/Workflows/WorkflowDetailSheet';
import { MOCK_WORKFLOW_GALLERY_ITEMS } from '@/utils/assistants/workflow-mock-data';

/**
 * The drawer itself, composed against real curated data rather than a
 * hand-built fixture — the shelf a reader actually sees. What this pins is
 * that the trust-model order survives: what it is, what it needs, what it
 * needs from you, what it will set up.
 */

const item = MOCK_WORKFLOW_GALLERY_ITEMS.find(
  (candidate) => candidate.workflow.slug === 'daily-briefing'
)!;

function renderSheet(overrides: Partial<React.ComponentProps<typeof WorkflowDetailSheet>> = {}) {
  const props: React.ComponentProps<typeof WorkflowDetailSheet> = {
    item: { workflow: item.workflow },
    open: true,
    canMutate: true,
    onOpenChange: () => {},
    onConnect: () => {},
    onInstall: () => {},
    onSaveParams: () => {},
    onUninstall: () => {},
    onToggleSetup: () => {},
    onStopSetup: () => {},
    onRetry: () => {},
    onUpdate: () => {},
    ...overrides,
  };
  return render(<WorkflowDetailSheet {...props} />);
}

describe('WorkflowDetailSheet', () => {
  it('leads with the long-form about, rendered as prose', () => {
    renderSheet();

    expect(screen.getByTestId('workflow-sheet-daily-briefing')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
    // The about is markdown, so its bold run renders as an element rather
    // than literal asterisks.
    expect(screen.getByText('Needs you')).toBeInTheDocument();
    expect(screen.getByText(/assembles one chat message/)).toBeInTheDocument();
  });

  it('shows the install-mode sections in trust order, with the version', () => {
    renderSheet();

    expect(screen.getByText('What it needs')).toBeInTheDocument();
    expect(screen.getByText('What it needs from you')).toBeInTheDocument();
    expect(screen.getByText('What it will set up')).toBeInTheDocument();
    expect(screen.getByText(`v${item.workflow.version}`)).toBeInTheDocument();
  });

  it('states availability without a plus glyph that reads as a control', () => {
    renderSheet();

    const badge = screen.getByTestId('workflow-status-available');
    expect(badge).toHaveTextContent('Available');
    expect(badge.querySelector('svg')).toBeNull();
  });

  it('previews a manifest item in place rather than leaving for its tab', () => {
    const onPreview = vi.fn();
    const onNavigate = vi.fn();
    renderSheet({ onPreview, onNavigate });

    // Tasks are open by default, so the recurring job's row is present.
    fireEvent.click(screen.getByTestId('workflow-manifest-open-tasks'));

    expect(onPreview).toHaveBeenCalledWith('tasks', 'Daily briefing');
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('falls back to opening the tab when no preview is wired', () => {
    const onNavigate = vi.fn();
    renderSheet({ onNavigate });

    fireEvent.click(screen.getByTestId('workflow-manifest-open-tasks'));
    expect(onNavigate).toHaveBeenCalledWith('tasks');
  });
});
