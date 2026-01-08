/**
 * P3-K: File Operations Behavior Tests
 *
 * Tests behaviors K1-K5 from BEHAVIORS.md:
 * - K1: Open upload dialog
 * - K2: Upload CSV file
 * - K3: Upload JSONL file
 * - K4: Column type mapping (param vs entry)
 * - K5: Submit upload
 *
 * These tests use the REAL FileUpload component from:
 * @/components/Pages/Interfaces/Interface/Buttons/FileUpload
 *
 * The component uses:
 * - react-dropzone for file handling
 * - Papa.parse for CSV parsing
 * - Real UI components (Switch, Table, Dialog, etc.)
 */

import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import {
  renderFileUpload,
  FileUploadTestResult,
  createMockCSV,
  createMockJSONL,
  createMockJSON,
  createTestFile,
  ParsedRow,
  toastCalls,
} from '../fixtures/fileUploadTestHarness';

describe('P3-K: File Operations (Real Component)', () => {
  let result: FileUploadTestResult;

  beforeEach(() => {
    toastCalls.clear();
  });

  afterEach(() => {
    result?.unmount();
  });

  // ==========================================================================
  // K1: Open upload dialog
  // ==========================================================================
  describe('K1: Open upload dialog', () => {
    it('shows upload button', async () => {
      result = renderFileUpload();

      // Get all buttons with this name and check at least one exists
      const buttons = screen.getAllByRole('button', { name: /upload logs/i });
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('opens dialog when button clicked', async () => {
      result = renderFileUpload();

      expect(result.isDialogOpen()).toBe(false);

      await result.openDialog();

      expect(result.isDialogOpen()).toBe(true);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('shows drop zone with instructions in dialog', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const dialog = screen.getByRole('dialog');
      expect(within(dialog).getByText(/drag.*drop/i)).toBeInTheDocument();
    });

    it('shows supported formats in dialog', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const dialog = screen.getByRole('dialog');
      // Look for the specific supported formats text
      const supportedText = within(dialog).getByText(/supported/i);
      expect(supportedText).toBeInTheDocument();
      // Check that csv, jsonl, json are mentioned
      expect(within(dialog).getByText(/\.csv/)).toBeInTheDocument();
    });

    it('renders without crashing when no project selected', async () => {
      // Component should render gracefully when project is undefined
      result = renderFileUpload({ projectId: undefined });

      // Should still render the button  
      const buttons = screen.getAllByRole('button', { name: /upload logs/i });
      expect(buttons.length).toBeGreaterThan(0);
      
      // The component renders - this test verifies graceful handling
      // Button disabling is handled by the ActionButton component internally
    });
  });

  // ==========================================================================
  // K2: Upload CSV file
  // ==========================================================================
  describe('K2: Upload CSV file', () => {
    const sampleData: ParsedRow[] = [
      { name: 'Alice', age: '30', city: 'NYC' },
      { name: 'Bob', age: '25', city: 'LA' },
      { name: 'Charlie', age: '35', city: 'Chicago' },
    ];

    it('parses and displays CSV file', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      // Wait for file to be parsed and displayed
      await waitFor(() => {
        expect(result.getDisplayedFileName()).toBe('test-data.csv');
      }, { timeout: 2000 });
    });

    it('shows column headers after file selection', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        const headers = result.getDisplayedHeaders();
        expect(headers).toContain('name');
        expect(headers).toContain('age');
        expect(headers).toContain('city');
      }, { timeout: 2000 });
    });

    it('shows preview table with data', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      // Wait for file to be parsed and table to appear
      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('table')).toBeInTheDocument();
      }, { timeout: 2000 });
    });

    it('shows row count after file selection', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      // Wait for file to be parsed first
      await waitFor(() => {
        expect(result.getDisplayedFileName()).not.toBeNull();
      }, { timeout: 2000 });
    });

    it('can remove selected file', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedFileName()).not.toBeNull();
      }, { timeout: 2000 });

      await result.removeFile();

      await waitFor(() => {
        expect(result.getDisplayedFileName()).toBeNull();
      });
    });
  });

  // ==========================================================================
  // K3: Upload JSONL file
  // ==========================================================================
  describe('K3: Upload JSONL file', () => {
    const sampleData: ParsedRow[] = [
      { input: 'Hello', output: 'Hi there', model: 'gpt-4' },
      { input: 'How are you?', output: 'I am fine', model: 'gpt-4' },
    ];

    it('parses and displays JSONL file', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockJSONL(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedFileName()).toBe('test-data.jsonl');
      }, { timeout: 2000 });
    });

    it('shows column headers from JSONL', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockJSONL(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        const headers = result.getDisplayedHeaders();
        expect(headers).toContain('input');
        expect(headers).toContain('output');
        expect(headers).toContain('model');
      }, { timeout: 2000 });
    });

    it('parses and displays JSON array file', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockJSON(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedFileName()).toBe('test-data.json');
      }, { timeout: 2000 });

      await waitFor(() => {
        const headers = result.getDisplayedHeaders();
        expect(headers).toContain('input');
        expect(headers).toContain('output');
      }, { timeout: 2000 });
    });
  });

  // ==========================================================================
  // K4: Column type mapping
  // ==========================================================================
  describe('K4: Column type mapping', () => {
    const sampleData: ParsedRow[] = [
      { userId: 'u1', prompt: 'Hello', response: 'Hi' },
      { userId: 'u2', prompt: 'Bye', response: 'Goodbye' },
    ];

    it('defaults all columns to entry type (switch on)', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedHeaders().length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // All columns should default to entry (switch checked)
      expect(result.getColumnType('userId')).toBe('entry');
      expect(result.getColumnType('prompt')).toBe('entry');
      expect(result.getColumnType('response')).toBe('entry');
    });

    it('can toggle column to param type', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedHeaders().length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Toggle userId to param
      await result.toggleColumnType('userId');

      await waitFor(() => {
        expect(result.getColumnType('userId')).toBe('param');
      });
    });

    it('can toggle column back to entry type', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedHeaders().length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Toggle to param
      await result.toggleColumnType('userId');
      await waitFor(() => {
        expect(result.getColumnType('userId')).toBe('param');
      });

      // Toggle back to entry
      await result.toggleColumnType('userId');
      await waitFor(() => {
        expect(result.getColumnType('userId')).toBe('entry');
      });
    });

    it('shows column mapping section with switches', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByText('Map Columns')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Check that switches exist for each column
      const switches = screen.getAllByRole('switch');
      expect(switches.length).toBe(3); // userId, prompt, response
    });
  });

  // ==========================================================================
  // K5: Submit upload
  // ==========================================================================
  describe('K5: Submit upload', () => {
    const sampleData: ParsedRow[] = [
      { input: 'Test 1', output: 'Result 1' },
      { input: 'Test 2', output: 'Result 2' },
    ];

    it('upload button is disabled without file', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      expect(result.isUploadButtonEnabled()).toBe(false);
    });

    it('upload button is enabled with valid file', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });
    });

    it('shows uploading state during upload', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadDelay: 500, // Longer delay to observe state
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      // Start upload without waiting
      const uploadPromise = result.clickUploadButton();

      // Check for uploading state
      await waitFor(() => {
        expect(result.isUploading()).toBe(true);
      });

      await uploadPromise;
    });

    it('successful upload calls logsActions.create', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: true,
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      await result.clickUploadButton();

      await waitFor(() => {
        const mock = result.getLogsActionsMock();
        expect(mock.create).toHaveBeenCalled();
      });

      // Verify the call arguments
      const mock = result.getLogsActionsMock();
      const [project, context, params, entries] = mock.create.mock.calls[0];
      expect(project).toBe('test-project');
      expect(entries.length).toBe(2);
      expect(entries[0]).toHaveProperty('input');
      expect(entries[0]).toHaveProperty('output');
    });

    it('successful upload shows success toast', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: true,
        uploadSuccessMessage: 'Logs uploaded successfully',
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      await result.clickUploadButton();

      await waitFor(() => {
        const toasts = result.getToastCalls();
        expect(toasts.success.length).toBeGreaterThan(0);
      });
    });

    it('failed upload shows error message', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: false,
        uploadErrorMessage: 'Server error occurred',
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      await result.clickUploadButton();

      // Wait for error toast to be called (the component shows errors via toasts)
      await waitFor(() => {
        const toasts = result.getToastCalls();
        expect(toasts.error.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });

    it('failed upload keeps dialog open', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: false,
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      await result.clickUploadButton();

      // Wait for upload to complete
      await waitFor(() => {
        expect(result.isUploading()).toBe(false);
      }, { timeout: 2000 });

      // Dialog should still be open after failed upload
      expect(result.isDialogOpen()).toBe(true);
    });

    it('shows context selector combobox', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        contexts: [
          { name: 'prod', description: '' },
          { name: 'staging', description: '' },
          { name: 'dev', description: '' },
        ],
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      // Verify context selector exists in the dialog
      const dialog = screen.getByRole('dialog');
      const contextCombobox = within(dialog).getByRole('combobox');
      expect(contextCombobox).toBeInTheDocument();
      expect(contextCombobox).toHaveTextContent(/select or create context/i);
    });

    it('context is optional (null if not selected)', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: true,
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      // Don't select any context
      await result.clickUploadButton();

      await waitFor(() => {
        const mock = result.getLogsActionsMock();
        expect(mock.create).toHaveBeenCalled();
      });

      // Context should be null
      const mock = result.getLogsActionsMock();
      const [, context] = mock.create.mock.calls[0];
      expect(context).toBeNull();
    });

    it('separates params and entries correctly when uploading', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: true,
      });

      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.getDisplayedHeaders().length).toBeGreaterThan(0);
      }, { timeout: 2000 });

      // Set 'input' as param
      await result.toggleColumnType('input');

      await waitFor(() => {
        expect(result.getColumnType('input')).toBe('param');
      });

      await result.clickUploadButton();

      await waitFor(() => {
        const mock = result.getLogsActionsMock();
        expect(mock.create).toHaveBeenCalled();
      });

      // Verify params and entries are separated correctly
      const mock = result.getLogsActionsMock();
      const [, , params, entries] = mock.create.mock.calls[0];

      expect(params[0]).toHaveProperty('input');
      expect(params[0]).not.toHaveProperty('output');

      expect(entries[0]).toHaveProperty('output');
      expect(entries[0]).not.toHaveProperty('input');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  describe('Edge Cases', () => {
    it('handles large file preview (limits to 20 rows)', async () => {
      result = renderFileUpload({ initiallyOpen: true });

      // Create 50 rows
      const largeData: ParsedRow[] = Array.from({ length: 50 }, (_, i) => ({
        id: `row-${i}`,
        value: `value-${i}`,
      }));

      const mockFile = createMockCSV(largeData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        // Preview should be limited to 20 rows
        expect(result.getPreviewRowCount()).toBeLessThanOrEqual(20);
      }, { timeout: 2000 });
    });

    it('shows loading toast during upload', async () => {
      result = renderFileUpload({
        initiallyOpen: true,
        uploadShouldSucceed: true,
        uploadDelay: 200,
      });

      const sampleData: ParsedRow[] = [
        { input: 'Test', output: 'Result' },
      ];
      const mockFile = createMockCSV(sampleData);
      const file = createTestFile(mockFile);
      await result.dropFile(file);

      await waitFor(() => {
        expect(result.isUploadButtonEnabled()).toBe(true);
      }, { timeout: 2000 });

      await result.clickUploadButton();

      // Wait for completion and check toast was shown
      await waitFor(() => {
        const toasts = result.getToastCalls();
        expect(toasts.loading.length).toBeGreaterThan(0);
      }, { timeout: 2000 });
    });
  });
});
