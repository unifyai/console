/**
 * File Upload Test Harness
 *
 * Tests file upload behaviors (K1-K5):
 * - K1: Open upload dialog
 * - K2: Upload CSV file
 * - K3: Upload JSONL file
 * - K4: Column type mapping (param vs entry)
 * - K5: Submit upload
 *
 * RENDERS THE REAL FileUpload component from:
 * @/components/Pages/Interfaces/Interface/Buttons/FileUpload
 *
 * Mocks:
 * - logsActions.create() for API calls
 * - Toast notifications
 */

import React, { act } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, Mock } from 'vitest';

// Real Component Import
import { FileUpload } from '@/components/Pages/Interfaces/Interface/Buttons/FileUpload';
import { LogsActions, Context } from '@/types/interfaces/grid';
import { ResponseProps } from '@/types/common';

// ============================================================================
// Mock Toast Notifications
// ============================================================================

// Track toast calls for test assertions
export const toastCalls = {
  loading: [] as Array<{ message: string; id?: string }>,
  success: [] as Array<{ message: string; id?: string }>,
  error: [] as Array<{ message: string; id?: string }>,
  clear: () => {
    toastCalls.loading = [];
    toastCalls.success = [];
    toastCalls.error = [];
  },
};

vi.mock('@/components/Common/Toasts/notifications', () => ({
  showLoadingToast: vi.fn((message: string) => {
    const id = `toast-${Date.now()}`;
    toastCalls.loading.push({ message, id });
    return id;
  }),
  showSuccessToast: vi.fn((message: string, _?: unknown, id?: string) => {
    toastCalls.success.push({ message, id });
  }),
  showErrorToast: vi.fn((message: string, _?: unknown, id?: string) => {
    toastCalls.error.push({ message, id });
  }),
}));

// ============================================================================
// Types
// ============================================================================

export type ColumnType = 'entry';

export interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

export interface UploadResult {
  success: boolean;
  rowCount: number;
  message: string;
}

export interface FileUploadTestOptions {
  /** Project ID to upload to */
  projectId?: string;
  /** Available contexts */
  contexts?: Context[];
  /** Whether the dialog starts open */
  initiallyOpen?: boolean;
  /** Whether upload should succeed */
  uploadShouldSucceed?: boolean;
  /** Custom upload success message */
  uploadSuccessMessage?: string;
  /** Custom upload error message */
  uploadErrorMessage?: string;
  /** Delay for simulated API call (ms) */
  uploadDelay?: number;
}

export interface FileUploadTestResult {
  container: HTMLElement;
  user: ReturnType<typeof userEvent.setup>;
  // Dialog state
  isDialogOpen: () => boolean;
  openDialog: () => Promise<void>;
  closeDialog: () => Promise<void>;
  // File operations (using real react-dropzone)
  dropFile: (file: File) => Promise<void>;
  getDisplayedFileName: () => string | null;
  removeFile: () => Promise<void>;
  // Column mapping (using real Switch components)
  getDisplayedHeaders: () => string[];
  toggleColumnType: (headerName: string) => Promise<void>;
  getColumnType: (headerName: string) => ColumnType | null;
  // Preview table
  getPreviewRowCount: () => number;
  // Context selection
  openContextSelector: () => Promise<void>;
  selectContext: (contextName: string) => Promise<void>;
  typeNewContext: (contextName: string) => Promise<void>;
  // Upload
  clickUploadButton: () => Promise<void>;
  isUploadButtonEnabled: () => boolean;
  isUploading: () => boolean;
  // Error handling
  getDisplayedError: () => string | null;
  dismissError: () => Promise<void>;
  // Toast assertions
  getToastCalls: () => typeof toastCalls;
  // Mock access
  getLogsActionsMock: () => { create: Mock };
  // Cleanup
  unmount: () => void;
}

export interface MockFile {
  name: string;
  type: string;
  content: string;
}

// ============================================================================
// File Creation Helpers
// ============================================================================

/**
 * Creates a real File object from mock data.
 * This is compatible with react-dropzone's file handling.
 */
export function createTestFile(mock: MockFile): File {
  const blob = new Blob([mock.content], { type: mock.type });
  return new File([blob], mock.name, { type: mock.type });
}

export function createMockCSV(rows: ParsedRow[], headers?: string[]): MockFile {
  const hdrs = headers || (rows.length > 0 ? Object.keys(rows[0]) : []);
  const csvContent = [
    hdrs.join(','),
    ...rows.map((row) =>
      hdrs
        .map((h) => {
          const val = row[h];
          if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
            return `"${val.replace(/"/g, '""')}"`;
          }
          return val ?? '';
        })
        .join(',')
    ),
  ].join('\n');

  return {
    name: 'test-data.csv',
    type: 'text/csv',
    content: csvContent,
  };
}

export function createMockJSONL(rows: ParsedRow[]): MockFile {
  const jsonlContent = rows.map((row) => JSON.stringify(row)).join('\n');

  return {
    name: 'test-data.jsonl',
    type: 'application/x-jsonlines',
    content: jsonlContent,
  };
}

export function createMockJSON(rows: ParsedRow[]): MockFile {
  const jsonContent = JSON.stringify(rows, null, 2);

  return {
    name: 'test-data.json',
    type: 'application/json',
    content: jsonContent,
  };
}

// ============================================================================
// Dropzone File Simulation
// ============================================================================

/**
 * Simulates file selection in react-dropzone by directly setting the
 * file input value. This is the most reliable way to test file uploads.
 */
async function simulateFileInput(container: HTMLElement, file: File): Promise<void> {
  // Find the hidden file input that react-dropzone creates
  const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
  if (!fileInput) {
    throw new Error('Could not find file input element');
  }

  // Create a DataTransfer to hold the file
  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);

  // Set the files on the input
  await act(async () => {
    // We need to define files as a property since it's normally read-only
    Object.defineProperty(fileInput, 'files', {
      value: dataTransfer.files,
      writable: false,
    });

    // Dispatch the change event
    const changeEvent = new Event('change', { bubbles: true });
    fileInput.dispatchEvent(changeEvent);
  });

  // Wait for file parsing to complete
  await waitFor(() => {}, { timeout: 500 });
}

// ============================================================================
// Render Function
// ============================================================================

export function renderFileUpload(options: FileUploadTestOptions = {}): FileUploadTestResult {
  const {
    projectId = 'test-project',
    contexts = [
      { name: 'context-1', description: '' },
      { name: 'context-2', description: '' },
    ],
    initiallyOpen = false,
    uploadShouldSucceed = true,
    uploadSuccessMessage = 'Successfully uploaded logs',
    uploadErrorMessage = 'Upload failed',
    uploadDelay = 50,
  } = options;

  // Clear toast tracking
  toastCalls.clear();

  // Create mock logsActions
  const mockLogsActions: LogsActions = {
    create: vi.fn(
      async (
        project: string,
        context: string | null,
        entries: Record<string, any>[]
      ): Promise<ResponseProps> => {
        // Simulate network delay
        await new Promise((r) => setTimeout(r, uploadDelay));

        if (uploadShouldSucceed) {
          return { info: uploadSuccessMessage };
        } else {
          return { detail: uploadErrorMessage };
        }
      }
    ),
    get: vi.fn(async () => ({ columns: [], logs: [], params: [], count: 0, groups: [] })),
    getLatest: vi.fn(async () => ''),
    getMetrics: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({ info: 'deleted' })),
    update: vi.fn(async () => ({ info: 'updated' })),
  };

  // Wrapper component to provide controlled open state
  function TestWrapper() {
    const [open, setOpen] = React.useState(initiallyOpen);

    // Store setOpen in ref for external access
    React.useEffect(() => {
      (window as any).__testSetDialogOpen = setOpen;
      (window as any).__testGetDialogOpen = () => open;
    }, [open]);

    return (
      <FileUpload
        project={projectId === undefined ? null : projectId}
        logsActions={mockLogsActions}
        contexts={contexts}
        customOpen={open}
        setCustomOpen={setOpen}
      />
    );
  }

  const user = userEvent.setup();
  const { container, unmount: originalUnmount } = render(<TestWrapper />);

  // Cleanup function
  const unmount = () => {
    delete (window as any).__testSetDialogOpen;
    delete (window as any).__testGetDialogOpen;
    originalUnmount();
  };

  return {
    container,
    user,

    // Dialog state
    isDialogOpen: () => {
      return screen.queryByRole('dialog') !== null;
    },

    openDialog: async () => {
      // Find all upload buttons and click the first one (the trigger button)
      const uploadButtons = screen.getAllByRole('button', { name: /upload logs/i });
      await user.click(uploadButtons[0]);
      // Wait for dialog to appear
      await waitFor(() => {
        if (!screen.queryByRole('dialog')) {
          throw new Error('Dialog did not open');
        }
      });
    },

    closeDialog: async () => {
      // Look for close button or click outside
      const closeButton = screen.queryByRole('button', { name: /close/i });
      if (closeButton) {
        await user.click(closeButton);
      }
      // Wait for dialog to close
      await waitFor(
        () => {
          if (screen.queryByRole('dialog')) {
            throw new Error('Dialog did not close');
          }
        },
        { timeout: 500 }
      );
    },

    // File operations
    dropFile: async (file: File) => {
      const dialog = screen.getByRole('dialog');
      await simulateFileInput(dialog, file);
    },

    getDisplayedFileName: () => {
      // After file is uploaded, the file name is shown in a span
      const fileNameElement = screen.queryByTitle(/.+\.(csv|jsonl|json)$/i);
      return fileNameElement?.textContent ?? null;
    },

    removeFile: async () => {
      const removeButton = screen.getByRole('button', { name: /remove file/i });
      await user.click(removeButton);
    },

    // Column mapping
    getDisplayedHeaders: () => {
      // Headers are shown as labels next to switches
      const dialog = screen.getByRole('dialog');
      const mapColumnsSection = within(dialog).queryByText('Map Columns');
      if (!mapColumnsSection) return [];

      const container = mapColumnsSection.closest('div');
      if (!container) return [];

      // Find all labels that are column names (not Param/Entry labels)
      const labels = within(container).queryAllByRole('switch');
      return labels
        .map((sw) => {
          const id = sw.getAttribute('id');
          if (id?.startsWith('switch-')) {
            return id.replace('switch-', '');
          }
          return '';
        })
        .filter(Boolean);
    },

    toggleColumnType: async (_headerName: string) => {
      // Param/entry toggle removed - all columns are now entries
      // This is a no-op for backwards compatibility with existing tests
    },

    getColumnType: (headerName: string): ColumnType | null => {
      const switchElement = screen.queryByRole('switch', {
        name: new RegExp(`mark ${headerName} as`, 'i'),
      });
      if (!switchElement) return null;
      // All columns are now entries (param support removed)
      return 'entry';
    },

    // Preview table
    getPreviewRowCount: () => {
      const dialog = screen.queryByRole('dialog');
      if (!dialog) return 0;
      // Find all rowgroups (thead and tbody both use rowgroup role)
      const rowgroups = within(dialog).queryAllByRole('rowgroup');
      // The tbody is typically the second rowgroup (after thead)
      // Count rows in all rowgroups except header rows
      let count = 0;
      rowgroups.forEach((rg, index) => {
        if (index > 0) {
          // Skip the first rowgroup (thead)
          count += within(rg).queryAllByRole('row').length;
        }
      });
      return count;
    },

    // Context selection
    openContextSelector: async () => {
      const contextButton = screen.getByRole('combobox', { name: /context/i });
      await user.click(contextButton);
    },

    selectContext: async (contextName: string) => {
      // First open the context selector
      const contextButton = screen.getByRole('combobox');
      await user.click(contextButton);

      // Then select the context
      const option = await screen.findByRole('option', { name: contextName });
      await user.click(option);
    },

    typeNewContext: async (contextName: string) => {
      // Find and click the context combobox button
      const dialog = screen.getByRole('dialog');
      const contextButton = within(dialog).getByRole('combobox');
      await user.click(contextButton);

      // Wait for the popover to open and find the input
      await waitFor(() => {
        if (!screen.queryByPlaceholderText(/search or type/i)) {
          throw new Error('Context search input not found');
        }
      });

      const input = screen.getByPlaceholderText(/search or type/i);
      await user.clear(input);
      await user.type(input, contextName);

      // Close the popover by clicking elsewhere or pressing escape
      await user.keyboard('{Escape}');
    },

    // Upload
    clickUploadButton: async () => {
      const dialog = screen.getByRole('dialog');
      // The upload button in the footer
      const uploadButton = within(dialog).getByRole('button', { name: /^upload logs$/i });
      await user.click(uploadButton);
    },

    isUploadButtonEnabled: () => {
      const dialog = screen.queryByRole('dialog');
      if (!dialog) return false;
      const uploadButton = within(dialog).queryByRole('button', { name: /^upload logs$/i });
      return uploadButton ? !uploadButton.hasAttribute('disabled') : false;
    },

    isUploading: () => {
      const dialog = screen.queryByRole('dialog');
      if (!dialog) return false;
      return within(dialog).queryByText(/uploading\.\.\./i) !== null;
    },

    // Error handling
    getDisplayedError: () => {
      const dialog = screen.queryByRole('dialog');
      if (!dialog) return null;
      const errorElement = within(dialog).queryByRole('alert');
      if (!errorElement) return null;
      // Get the text content, excluding the dismiss button
      const textElement = errorElement.querySelector('p');
      return textElement?.textContent ?? null;
    },

    dismissError: async () => {
      const dialog = screen.getByRole('dialog');
      const errorElement = within(dialog).getByRole('alert');
      const dismissButton = within(errorElement).getByRole('button');
      await user.click(dismissButton);
    },

    // Toast assertions
    getToastCalls: () => toastCalls,

    // Mock access
    getLogsActionsMock: () => ({
      create: mockLogsActions.create as Mock,
    }),

    unmount,
  };
}

// ============================================================================
// Re-export types
// ============================================================================

export type { Context };
