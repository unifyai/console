/**
 * P2-G: Editor Tile Behavior Tests
 *
 * Tests code editor behaviors including file management,
 * code editing, and execution.
 * 
 * Covers behaviors from BEHAVIORS.md:
 * - G1: Create file
 * - G2: Edit code
 * - G3: Run code
 * - G4: Env vars
 * - G5: Delete file
 * - G6: Rename file
 * - G7: File navigation
 * - G8: Read-only mode
 */
import { describe, it, expect, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderEditorTile, createMockFiles } from '../fixtures/editorTileTestHarness';

// =============================================================================
// P2-G: Editor Tile
// =============================================================================

describe('P2-G: Editor Tile', () => {
  
  // =========================================================================
  // G1: Create file
  // =========================================================================
  describe('G1: Create file', () => {
    it('clicking new file button shows input', async () => {
      const user = userEvent.setup();
      renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('new-file-button'));

      await waitFor(() => {
        expect(screen.getByTestId('new-file-form')).toBeInTheDocument();
        expect(screen.getByTestId('new-file-input')).toBeInTheDocument();
      });
    });

    it('creating a file adds it to explorer', async () => {
      const user = userEvent.setup();
      const onCreateFile = vi.fn();
      const { getFiles } = renderEditorTile({
        callbacks: { onCreateFile },
      });

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      const initialCount = getFiles().length;

      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), 'newfile.js{Enter}');

      await waitFor(() => {
        expect(getFiles()).toHaveLength(initialCount + 1);
        expect(getFiles().some((f) => f.name === 'newfile.js')).toBe(true);
      });

      expect(onCreateFile).toHaveBeenCalledWith('newfile.js');
    });

    it('new file becomes active', async () => {
      const user = userEvent.setup();
      const { getActiveFile, getFiles } = renderEditorTile();

      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), 'active.py{Enter}');

      await waitFor(() => {
        const newFile = getFiles().find((f) => f.name === 'active.py');
        expect(newFile).toBeDefined();
        expect(getActiveFile()).toBe(newFile!.id);
      });
    });

    it('pressing Escape cancels file creation', async () => {
      const user = userEvent.setup();
      const { getFiles } = renderEditorTile();

      const initialCount = getFiles().length;

      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), 'cancelled.js{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('new-file-form')).not.toBeInTheDocument();
      });

      expect(getFiles()).toHaveLength(initialCount);
    });
  });

  // =========================================================================
  // G2: Edit code
  // =========================================================================
  describe('G2: Edit code', () => {
    it('typing in editor updates content', async () => {
      const user = userEvent.setup();
      const onContentChange = vi.fn();
      const { getFileContent, getActiveFile } = renderEditorTile({
        callbacks: { onContentChange },
      });

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });

      const activeId = getActiveFile()!;
      const editor = screen.getByTestId('code-editor');
      
      await user.clear(editor);
      await user.type(editor, 'const x = 1;');

      await waitFor(() => {
        expect(getFileContent(activeId)).toBe('const x = 1;');
      });

      expect(onContentChange).toHaveBeenCalled();
    });

    it('shows active file name in header', async () => {
      renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('active-file-name')).toHaveTextContent('main.py');
      });
    });

    it('editor shows file content', async () => {
      const files = createMockFiles();
      renderEditorTile({ initialFiles: files });

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toBeInTheDocument();
      });

      expect(screen.getByTestId('code-editor')).toHaveValue('print("Hello, World!")');
    });
  });

  // =========================================================================
  // G3: Run code
  // =========================================================================
  describe('G3: Run code', () => {
    it('clicking run button executes code', async () => {
      const user = userEvent.setup();
      const onRun = vi.fn();
      renderEditorTile({
        callbacks: { onRun },
      });

      await waitFor(() => {
        expect(screen.getByTestId('run-button')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('run-button'));

      await waitFor(() => {
        expect(onRun).toHaveBeenCalled();
      });
    });

    it('shows loading state while running', async () => {
      const user = userEvent.setup();
      const { isRunning } = renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('run-button')).toBeInTheDocument();
      });

      expect(isRunning()).toBe(false);

      await user.click(screen.getByTestId('run-button'));

      // Should briefly be in running state
      await waitFor(() => {
        expect(screen.getByTestId('run-button')).toHaveTextContent('Running...');
      });

      // Wait for completion
      await waitFor(() => {
        expect(isRunning()).toBe(false);
      }, { timeout: 1000 });
    });

    it('shows output panel after execution', async () => {
      const user = userEvent.setup();
      const { getOutput } = renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('run-button')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('output-panel')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('run-button'));

      await waitFor(() => {
        expect(screen.getByTestId('output-panel')).toBeInTheDocument();
        expect(getOutput()).toBeTruthy();
      }, { timeout: 1000 });
    });

    it('run button is disabled when no file selected', async () => {
      renderEditorTile({ initialFiles: [] });

      await waitFor(() => {
        expect(screen.getByTestId('run-button')).toBeInTheDocument();
      });

      expect(screen.getByTestId('run-button')).toBeDisabled();
    });
  });

  // =========================================================================
  // G4: Env vars
  // =========================================================================
  describe('G4: Env vars', () => {
    it('clicking env vars toggle shows panel', async () => {
      const user = userEvent.setup();
      renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('env-vars-toggle')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('env-vars-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('env-vars-panel')).toBeInTheDocument();
      });
    });

    it('can add environment variable', async () => {
      const user = userEvent.setup();
      const onEnvVarChange = vi.fn();
      const { getEnvVars } = renderEditorTile({
        callbacks: { onEnvVarChange },
      });

      await user.click(screen.getByTestId('env-vars-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('env-vars-panel')).toBeInTheDocument();
      });

      await user.type(screen.getByTestId('env-key-input'), 'API_KEY');
      await user.type(screen.getByTestId('env-value-input'), 'secret123');
      await user.click(screen.getByTestId('add-env-button'));

      await waitFor(() => {
        expect(getEnvVars()).toHaveLength(1);
        expect(getEnvVars()[0]).toEqual({ key: 'API_KEY', value: 'secret123' });
      });

      expect(onEnvVarChange).toHaveBeenCalled();
    });

    it('displays existing env vars', async () => {
      const user = userEvent.setup();
      renderEditorTile({
        initialEnvVars: [
          { key: 'NODE_ENV', value: 'development' },
          { key: 'DEBUG', value: 'true' },
        ],
      });

      await user.click(screen.getByTestId('env-vars-toggle'));

      await waitFor(() => {
        expect(screen.getByTestId('env-var-0')).toHaveTextContent('NODE_ENV=development');
        expect(screen.getByTestId('env-var-1')).toHaveTextContent('DEBUG=true');
      });
    });
  });

  // =========================================================================
  // G5: Delete file
  // =========================================================================
  describe('G5: Delete file', () => {
    it('clicking delete removes file', async () => {
      const user = userEvent.setup();
      const onDeleteFile = vi.fn();
      const { getFiles } = renderEditorTile({
        callbacks: { onDeleteFile },
      });

      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });

      const initialCount = getFiles().length;
      const fileToDelete = getFiles().find((f) => !f.readOnly);

      await user.click(screen.getByTestId(`delete-file-${fileToDelete!.id}`));

      await waitFor(() => {
        expect(getFiles()).toHaveLength(initialCount - 1);
        expect(getFiles().some((f) => f.id === fileToDelete!.id)).toBe(false);
      });

      expect(onDeleteFile).toHaveBeenCalledWith(fileToDelete!.id);
    });

    it('deleting active file switches to another', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      const { getActiveFile, getFiles } = renderEditorTile({
        initialFiles: files,
        initialActiveFile: files[0].id,
      });

      await waitFor(() => {
        expect(getActiveFile()).toBe(files[0].id);
      });

      await user.click(screen.getByTestId(`delete-file-${files[0].id}`));

      await waitFor(() => {
        const remainingFiles = getFiles();
        expect(remainingFiles.some((f) => f.id === files[0].id)).toBe(false);
        expect(getActiveFile()).toBe(remainingFiles[0]?.id ?? null);
      });
    });

    it('read-only files cannot be deleted', async () => {
      const files = createMockFiles();
      const readOnlyFile = files.find((f) => f.readOnly);
      renderEditorTile({ initialFiles: files });

      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });

      // Delete button should not exist for read-only files
      expect(screen.queryByTestId(`delete-file-${readOnlyFile!.id}`)).not.toBeInTheDocument();
    });
  });

  // =========================================================================
  // G6: Rename file
  // =========================================================================
  describe('G6: Rename file', () => {
    it('double-clicking file name enables rename', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      const editableFile = files.find((f) => !f.readOnly);
      renderEditorTile({ initialFiles: files });

      await waitFor(() => {
        expect(screen.getByTestId('file-explorer')).toBeInTheDocument();
      });

      await user.dblClick(screen.getByTestId(`file-button-${editableFile!.id}`));

      await waitFor(() => {
        expect(screen.getByTestId('rename-input')).toBeInTheDocument();
      });
    });

    it('renaming updates file name', async () => {
      const user = userEvent.setup();
      const onRenameFile = vi.fn();
      const files = createMockFiles();
      const editableFile = files.find((f) => !f.readOnly);
      const { getFiles } = renderEditorTile({
        initialFiles: files,
        callbacks: { onRenameFile },
      });

      await user.dblClick(screen.getByTestId(`file-button-${editableFile!.id}`));

      await waitFor(() => {
        expect(screen.getByTestId('rename-input')).toBeInTheDocument();
      });

      await user.clear(screen.getByTestId('rename-input'));
      await user.type(screen.getByTestId('rename-input'), 'renamed.py{Enter}');

      await waitFor(() => {
        expect(getFiles().find((f) => f.id === editableFile!.id)?.name).toBe('renamed.py');
      });

      expect(onRenameFile).toHaveBeenCalledWith(editableFile!.id, 'renamed.py');
    });

    it('pressing Escape cancels rename', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      const editableFile = files.find((f) => !f.readOnly);
      const { getFiles } = renderEditorTile({ initialFiles: files });

      const originalName = editableFile!.name;

      await user.dblClick(screen.getByTestId(`file-button-${editableFile!.id}`));
      await user.clear(screen.getByTestId('rename-input'));
      await user.type(screen.getByTestId('rename-input'), 'cancelled{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('rename-input')).not.toBeInTheDocument();
      });

      expect(getFiles().find((f) => f.id === editableFile!.id)?.name).toBe(originalName);
    });
  });

  // =========================================================================
  // G7: File navigation
  // =========================================================================
  describe('G7: File navigation', () => {
    it('clicking file selects it', async () => {
      const user = userEvent.setup();
      const onFileSelect = vi.fn();
      const files = createMockFiles();
      const { getActiveFile } = renderEditorTile({
        initialFiles: files,
        initialActiveFile: files[0].id,
        callbacks: { onFileSelect },
      });

      await waitFor(() => {
        expect(getActiveFile()).toBe(files[0].id);
      });

      await user.click(screen.getByTestId(`file-button-${files[1].id}`));

      await waitFor(() => {
        expect(getActiveFile()).toBe(files[1].id);
      });

      expect(onFileSelect).toHaveBeenCalledWith(files[1].id);
    });

    it('active file is highlighted', async () => {
      const files = createMockFiles();
      renderEditorTile({
        initialFiles: files,
        initialActiveFile: files[1].id,
      });

      await waitFor(() => {
        expect(screen.getByTestId(`file-item-${files[1].id}`)).toHaveAttribute('data-active', 'true');
        expect(screen.getByTestId(`file-item-${files[0].id}`)).toHaveAttribute('data-active', 'false');
      });
    });

    it('switching files updates editor content', async () => {
      const user = userEvent.setup();
      const files = [
        { id: 'f1', name: 'file1.js', content: 'content1', type: 'file' as const },
        { id: 'f2', name: 'file2.js', content: 'content2', type: 'file' as const },
      ];
      renderEditorTile({ initialFiles: files, initialActiveFile: 'f1' });

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toHaveValue('content1');
      });

      await user.click(screen.getByTestId('file-button-f2'));

      await waitFor(() => {
        expect(screen.getByTestId('code-editor')).toHaveValue('content2');
      });
    });
  });

  // =========================================================================
  // G8: Read-only mode
  // =========================================================================
  describe('G8: Read-only mode', () => {
    it('read-only files show lock icon', async () => {
      const files = createMockFiles();
      const readOnlyFile = files.find((f) => f.readOnly);
      renderEditorTile({ initialFiles: files });

      await waitFor(() => {
        expect(screen.getByTestId(`lock-icon-${readOnlyFile!.id}`)).toBeInTheDocument();
      });
    });

    it('read-only files show warning when opened', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      const readOnlyFile = files.find((f) => f.readOnly);
      renderEditorTile({ initialFiles: files });

      await user.click(screen.getByTestId(`file-button-${readOnlyFile!.id}`));

      await waitFor(() => {
        expect(screen.getByTestId('readonly-warning')).toBeInTheDocument();
        expect(screen.getByTestId('readonly-warning')).toHaveTextContent('read-only');
      });
    });

    it('read-only files display content but no editor', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      const readOnlyFile = files.find((f) => f.readOnly);
      renderEditorTile({ initialFiles: files });

      await user.click(screen.getByTestId(`file-button-${readOnlyFile!.id}`));

      await waitFor(() => {
        expect(screen.getByTestId('readonly-content')).toBeInTheDocument();
        expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument();
      });
    });

    it('read-only files cannot be renamed', async () => {
      const user = userEvent.setup();
      const files = createMockFiles();
      const readOnlyFile = files.find((f) => f.readOnly);
      renderEditorTile({ initialFiles: files });

      await user.dblClick(screen.getByTestId(`file-button-${readOnlyFile!.id}`));

      // Rename input should not appear
      await waitFor(() => {
        expect(screen.queryByTestId('rename-input')).not.toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    it('handles empty file list', async () => {
      renderEditorTile({ initialFiles: [] });

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      expect(screen.getByTestId('no-file-message')).toBeInTheDocument();
    });

    it('respects initial active file', async () => {
      const files = createMockFiles();
      const { getActiveFile } = renderEditorTile({
        initialFiles: files,
        initialActiveFile: files[1].id,
      });

      await waitFor(() => {
        expect(getActiveFile()).toBe(files[1].id);
      });
    });

    it('respects initial output', async () => {
      const { getOutput } = renderEditorTile({
        initialOutput: 'Previous output',
      });

      await waitFor(() => {
        expect(getOutput()).toBe('Previous output');
        expect(screen.getByTestId('output-panel')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // Error Handling
  // =========================================================================
  describe('Error handling', () => {
    it('handles empty file name gracefully', async () => {
      const user = userEvent.setup();
      const { getFiles } = renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      const initialCount = getFiles().length;

      // Try to create file with empty name
      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), '{Enter}');

      // File should not be created
      expect(getFiles()).toHaveLength(initialCount);
    });

    it('handles whitespace-only file name', async () => {
      const user = userEvent.setup();
      const { getFiles } = renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      const initialCount = getFiles().length;

      // Try to create file with whitespace name
      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), '   {Enter}');

      // File should not be created (whitespace trimmed = empty)
      expect(getFiles()).toHaveLength(initialCount);
    });

    it('handles deletion of last file', async () => {
      const user = userEvent.setup();
      const singleFile = [{ id: 'only-file', name: 'only.js', content: 'code', type: 'file' as const }];
      const { getFiles } = renderEditorTile({
        initialFiles: singleFile,
        initialActiveFile: 'only-file',
      });

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('delete-file-only-file'));

      await waitFor(() => {
        expect(getFiles()).toHaveLength(0);
      });

      // Should show no file message when all files are deleted
      expect(screen.getByTestId('no-file-message')).toBeInTheDocument();
    });

    it('handles rapid file creation', async () => {
      const user = userEvent.setup();
      const { getFiles } = renderEditorTile({ initialFiles: [] });

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      // Create multiple files quickly
      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), 'file1.js{Enter}');

      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), 'file2.js{Enter}');

      await waitFor(() => {
        expect(getFiles()).toHaveLength(2);
      });
    });

    it('handles run with empty content', async () => {
      const user = userEvent.setup();
      const emptyFile = [{ id: 'empty', name: 'empty.js', content: '', type: 'file' as const }];
      const { getOutput } = renderEditorTile({
        initialFiles: emptyFile,
        initialActiveFile: 'empty',
      });

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('run-button'));

      // Should complete without error, output may be empty or show message
      await waitFor(() => {
        expect(screen.getByTestId('output-panel')).toBeInTheDocument();
      }, { timeout: 1000 });
    });

    it('handles special characters in file name', async () => {
      const user = userEvent.setup();
      const { getFiles } = renderEditorTile();

      await waitFor(() => {
        expect(screen.getByTestId('editor-tile-container')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('new-file-button'));
      await user.type(screen.getByTestId('new-file-input'), 'test-file_v2.spec.ts{Enter}');

      await waitFor(() => {
        expect(getFiles().some(f => f.name === 'test-file_v2.spec.ts')).toBe(true);
      });
    });
  });
});


