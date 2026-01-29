/**
 * Popover with Tooltip Integration Test
 *
 * Regression test for the bug where wrapping a PopoverTrigger with a Tooltip
 * component blocked the PopoverTrigger's click handler from firing.
 *
 * The fix was to restructure the component hierarchy from:
 *   PopoverTrigger (asChild) -> Tooltip -> Button  [BROKEN]
 * to:
 *   Tooltip -> PopoverTrigger (asChild) -> Button  [WORKING]
 *
 * This test ensures the pattern works correctly.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/UI/popover';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { Button } from '@/components/UI/button';

describe('Popover with Tooltip Integration', () => {
  /**
   * Test the CORRECT pattern: Tooltip wrapping PopoverTrigger
   * This is the pattern used after the fix.
   */
  it('opens popover when Tooltip wraps PopoverTrigger (correct pattern)', async () => {
    const user = userEvent.setup();

    function CorrectPattern() {
      const [open, setOpen] = useState(false);

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip content="This is a tooltip">
            <PopoverTrigger asChild>
              <Button data-testid="trigger-button">Click me</Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent data-testid="popover-content">
            <div>Popover content here</div>
          </PopoverContent>
        </Popover>
      );
    }

    render(<CorrectPattern />);

    // Popover should not be visible initially
    expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();

    // Click the button
    const button = screen.getByTestId('trigger-button');
    await user.click(button);

    // Popover should now be visible
    await waitFor(() => {
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });

    // Click again to close
    await user.click(button);

    // Popover should be closed
    await waitFor(() => {
      expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
    });
  });

  /**
   * Test that the popover can be controlled programmatically
   * even when using the Tooltip wrapper.
   */
  it('allows programmatic control of popover with Tooltip wrapper', async () => {
    const user = userEvent.setup();

    function ProgrammaticControl() {
      const [popoverOpen, setPopoverOpen] = useState(false);

      return (
        <div>
          <button data-testid="external-open" onClick={() => setPopoverOpen(true)}>
            Open Popover Externally
          </button>
          <button data-testid="external-close" onClick={() => setPopoverOpen(false)}>
            Close Popover Externally
          </button>

          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <Tooltip content="Tooltip text">
              <PopoverTrigger asChild>
                <Button data-testid="trigger-button">Trigger</Button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent data-testid="popover-content">
              <div>Content</div>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    render(<ProgrammaticControl />);

    // Initially closed
    expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();

    // Open via external button
    await user.click(screen.getByTestId('external-open'));

    await waitFor(() => {
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });

    // Close via external button
    await user.click(screen.getByTestId('external-close'));

    await waitFor(() => {
      expect(screen.queryByTestId('popover-content')).not.toBeInTheDocument();
    });

    // Open via trigger button (tests that both methods work)
    await user.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });
  });

  /**
   * Test that clicking inside popover content doesn't close it immediately.
   */
  it('popover stays open when interacting with content', async () => {
    const user = userEvent.setup();

    function InteractivePopover() {
      const [open, setOpen] = useState(false);
      const [inputValue, setInputValue] = useState('');

      return (
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip content="Open context selector">
            <PopoverTrigger asChild>
              <Button data-testid="trigger-button">Select Context</Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent data-testid="popover-content">
            <input
              data-testid="popover-input"
              type="text"
              placeholder="Search..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
            />
            <button data-testid="popover-action">Action</button>
          </PopoverContent>
        </Popover>
      );
    }

    render(<InteractivePopover />);

    // Open popover
    await user.click(screen.getByTestId('trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    });

    // Interact with input inside popover
    const input = screen.getByTestId('popover-input');
    await user.type(input, 'test search');

    // Popover should still be open
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();
    expect(input).toHaveValue('test search');

    // Click action button inside popover
    await user.click(screen.getByTestId('popover-action'));

    // Popover should still be open (action doesn't close it)
    expect(screen.getByTestId('popover-content')).toBeInTheDocument();
  });

  /**
   * Test multiple popovers with tooltips don't interfere with each other.
   */
  it('multiple popovers with tooltips work independently', async () => {
    const user = userEvent.setup();

    function MultiplePopovers() {
      const [open1, setOpen1] = useState(false);
      const [open2, setOpen2] = useState(false);

      return (
        <div>
          <Popover open={open1} onOpenChange={setOpen1}>
            <Tooltip content="Tooltip 1">
              <PopoverTrigger asChild>
                <Button data-testid="trigger-1">Popover 1</Button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent data-testid="content-1">
              <div>Content 1</div>
            </PopoverContent>
          </Popover>

          <Popover open={open2} onOpenChange={setOpen2}>
            <Tooltip content="Tooltip 2">
              <PopoverTrigger asChild>
                <Button data-testid="trigger-2">Popover 2</Button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent data-testid="content-2">
              <div>Content 2</div>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    render(<MultiplePopovers />);

    // Initially both closed
    expect(screen.queryByTestId('content-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('content-2')).not.toBeInTheDocument();

    // Open first popover
    await user.click(screen.getByTestId('trigger-1'));

    await waitFor(() => {
      expect(screen.getByTestId('content-1')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('content-2')).not.toBeInTheDocument();

    // Open second popover (first should close due to Radix behavior)
    await user.click(screen.getByTestId('trigger-2'));

    await waitFor(() => {
      expect(screen.getByTestId('content-2')).toBeInTheDocument();
    });
  });

  /**
   * Regression test: Ensure the Context button pattern from Table.tsx works.
   * This mimics the exact structure used in the Table component.
   */
  it('Context button pattern from Table.tsx opens popover correctly', async () => {
    const user = userEvent.setup();

    function ContextButtonPattern() {
      const [tableContextPopoverOpen, setTableContextPopoverOpen] = useState(false);
      const [selectedContext, setSelectedContext] = useState<string | null>(null);

      const contexts = ['production', 'staging', 'development'];

      return (
        <Popover open={tableContextPopoverOpen} onOpenChange={setTableContextPopoverOpen}>
          <Tooltip content="Filter logs by context">
            <PopoverTrigger asChild>
              <Button
                data-testid="context-button"
                variant={selectedContext ? 'default' : 'outline'}
                size="sm"
              >
                Context
              </Button>
            </PopoverTrigger>
          </Tooltip>
          <PopoverContent data-testid="context-popover" className="w-96 p-0">
            <div className="p-2">
              <input data-testid="context-search" type="text" placeholder="Search contexts..." />
            </div>
            <div data-testid="context-list">
              {contexts.map((ctx) => (
                <button
                  key={ctx}
                  data-testid={`context-option-${ctx}`}
                  onClick={() => {
                    setSelectedContext(ctx);
                    setTableContextPopoverOpen(false);
                  }}
                >
                  {ctx}
                </button>
              ))}
            </div>
            <div className="border-t p-2">
              <button
                data-testid="clear-context"
                onClick={() => {
                  setSelectedContext(null);
                }}
              >
                Clear selection
              </button>
              <button data-testid="cancel-button" onClick={() => setTableContextPopoverOpen(false)}>
                Cancel
              </button>
            </div>
          </PopoverContent>
        </Popover>
      );
    }

    render(<ContextButtonPattern />);

    // Initially popover is closed
    expect(screen.queryByTestId('context-popover')).not.toBeInTheDocument();

    // Click Context button
    const contextButton = screen.getByTestId('context-button');
    await user.click(contextButton);

    // Popover should open
    await waitFor(() => {
      expect(screen.getByTestId('context-popover')).toBeInTheDocument();
    });

    // Verify context list is visible
    expect(screen.getByTestId('context-list')).toBeInTheDocument();
    expect(screen.getByTestId('context-option-production')).toBeInTheDocument();
    expect(screen.getByTestId('context-option-staging')).toBeInTheDocument();
    expect(screen.getByTestId('context-option-development')).toBeInTheDocument();

    // Select a context
    await user.click(screen.getByTestId('context-option-staging'));

    // Popover should close after selection
    await waitFor(() => {
      expect(screen.queryByTestId('context-popover')).not.toBeInTheDocument();
    });

    // Open again and cancel
    await user.click(contextButton);

    await waitFor(() => {
      expect(screen.getByTestId('context-popover')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('cancel-button'));

    await waitFor(() => {
      expect(screen.queryByTestId('context-popover')).not.toBeInTheDocument();
    });
  });

  /**
   * Test the "Select a Context" center button pattern
   * This tests programmatic opening from a different button.
   */
  it('external button can open popover programmatically (center overlay pattern)', async () => {
    const user = userEvent.setup();

    function CenterButtonPattern() {
      const [tableContextPopoverOpen, setTableContextPopoverOpen] = useState(false);

      return (
        <div>
          {/* This is the center "Select a Context" button from EmptyTableOverlay */}
          <Button
            data-testid="select-context-center-button"
            onClick={(e) => {
              e.stopPropagation();
              setTableContextPopoverOpen(true);
            }}
          >
            Select a Context
          </Button>

          {/* This is the popover with the Context button trigger */}
          <Popover open={tableContextPopoverOpen} onOpenChange={setTableContextPopoverOpen}>
            <Tooltip content="Filter logs by context">
              <PopoverTrigger asChild>
                <Button data-testid="context-trigger-button">Context</Button>
              </PopoverTrigger>
            </Tooltip>
            <PopoverContent data-testid="context-popover">
              <div>Context picker content</div>
              <button data-testid="close-popover" onClick={() => setTableContextPopoverOpen(false)}>
                Close
              </button>
            </PopoverContent>
          </Popover>
        </div>
      );
    }

    render(<CenterButtonPattern />);

    // Initially closed
    expect(screen.queryByTestId('context-popover')).not.toBeInTheDocument();

    // Click the center "Select a Context" button
    await user.click(screen.getByTestId('select-context-center-button'));

    // Popover should open
    await waitFor(() => {
      expect(screen.getByTestId('context-popover')).toBeInTheDocument();
    });

    // Close it
    await user.click(screen.getByTestId('close-popover'));

    await waitFor(() => {
      expect(screen.queryByTestId('context-popover')).not.toBeInTheDocument();
    });

    // Also test that clicking the trigger button works
    await user.click(screen.getByTestId('context-trigger-button'));

    await waitFor(() => {
      expect(screen.getByTestId('context-popover')).toBeInTheDocument();
    });
  });
});
