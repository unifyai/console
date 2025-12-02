/**
 * Editor Tile Test Harness
 * 
 * A reusable wrapper for testing code editor behaviors including
 * file management, code editing, and execution.
 * 
 * IMPROVED: Uses REAL Zustand store and `useEditorTile` hook for content management.
 * 
 * Usage:
 *   import { renderEditorTile } from '../fixtures/editorTileTestHarness';
 *   
 *   it('creates a file', async () => {
 *     const { getFiles, createFile } = renderEditorTile();
 *     createFile('test.js');
 *     expect(getFiles().some(f => f.name === 'test.js')).toBe(true);
 *   });
 */
import React, { useState, useCallback, useEffect } from 'react';
import { render, RenderResult, act } from '@testing-library/react';
import { File, Folder, Plus, Trash2, Play, Loader2, Lock } from 'lucide-react';

// Shared test utilities
import { useStateContainer } from '../utils';

// Real Store Imports
import { StoreProvider, useStoreContext } from '@/contexts/providers/StoreProvider';
import { useEditorTile } from '@/contexts/hooks/tile/useEditorTile';
import { initTile } from '@/contexts/slices/selectors/tile';
import { initEditorTile } from '@/contexts/slices/selectors/editorTile';
import { initTab } from '@/contexts/slices/selectors/tab';
import { IStoreState } from '@/contexts/store';

// =============================================================================
// Types
// =============================================================================

export interface EditorFile {
  id: string;
  name: string;
  content: string;
  readOnly?: boolean;
  type: 'file' | 'folder';
}

export interface EnvVar {
  key: string;
  value: string;
}

export interface EditorTileCallbacks {
  onCreateFile?: (name: string) => void;
  onDeleteFile?: (id: string) => void;
  onRenameFile?: (id: string, newName: string) => void;
  onFileSelect?: (id: string) => void;
  onContentChange?: (id: string, content: string) => void;
  onRun?: (output: string) => void;
  onEnvVarChange?: (vars: EnvVar[]) => void;
}

export interface EditorTileTestOptions {
  /** Initial files */
  initialFiles?: EditorFile[];
  /** Initially active file ID */
  initialActiveFile?: string;
  /** Initial environment variables */
  initialEnvVars?: EnvVar[];
  /** Initial output */
  initialOutput?: string;
  /** Callbacks for actions */
  callbacks?: EditorTileCallbacks;
  /** Whether execution is in progress */
  initialRunning?: boolean;
}

export interface EditorTileTestResult extends RenderResult {
  /** Get all files */
  getFiles: () => EditorFile[];
  /** Get active file ID */
  getActiveFile: () => string | null;
  /** Get file content */
  getFileContent: (id: string) => string;
  /** Get environment variables */
  getEnvVars: () => EnvVar[];
  /** Get output */
  getOutput: () => string;
  /** Check if running */
  isRunning: () => boolean;
  /** Create a new file */
  createFile: (name: string) => void;
  /** Delete a file */
  deleteFile: (id: string) => void;
  /** Rename a file */
  renameFile: (id: string, newName: string) => void;
  /** Select a file */
  selectFile: (id: string) => void;
  /** Update file content */
  updateContent: (id: string, content: string) => void;
  /** Run code */
  run: () => void;
  /** Add environment variable */
  addEnvVar: (key: string, value: string) => void;
}

// =============================================================================
// Constants
// =============================================================================

const TAB_ID = 'test-tab';
const TILE_ID = 'test-editor-tile';

// =============================================================================
// Mock Data
// =============================================================================

export function createMockFiles(): EditorFile[] {
  return [
    { id: 'file-1', name: 'main.py', content: 'print("Hello, World!")', type: 'file' },
    { id: 'file-2', name: 'utils.py', content: '# Utility functions', type: 'file' },
    { id: 'file-3', name: 'README.md', content: '# Project', type: 'file', readOnly: true },
  ];
}

// =============================================================================
// Internal State Container
// =============================================================================

interface StateContainer {
  getFiles: () => EditorFile[];
  getActiveFile: () => string | null;
  getFileContent: (id: string) => string;
  getEnvVars: () => EnvVar[];
  getOutput: () => string;
  isRunning: () => boolean;
  createFile: (name: string) => void;
  deleteFile: (id: string) => void;
  renameFile: (id: string, newName: string) => void;
  selectFile: (id: string) => void;
  updateContent: (id: string, content: string) => void;
  run: () => void;
  addEnvVar: (key: string, value: string) => void;
}

// =============================================================================
// Initial Store State Builder
// =============================================================================

function createInitialStoreState(initialContent: string): Partial<IStoreState> {
  const tab = initTab(TAB_ID, { name: 'Test Tab', tileIds: [TILE_ID] });
  
  const tile = initTile(TILE_ID, {
    type: 'Editor',
    tabId: TAB_ID,
    visible: true,
    editorTile: initEditorTile({
      file_name: 'main.py',
      file_type: 'python',
      content: initialContent,
    })
  });

  return {
    activeTabId: TAB_ID,
    tabsById: {
      [TAB_ID]: tab
    },
    tilesById: {
      [TILE_ID]: tile
    }
  };
}

// =============================================================================
// Editor Tile Wrapper Component
// =============================================================================

interface EditorTileWrapperProps extends EditorTileTestOptions {
  stateContainerRef: React.MutableRefObject<StateContainer | null>;
}

function EditorTileWrapper({
  initialFiles,
  initialActiveFile,
  initialEnvVars = [],
  initialOutput = '',
  callbacks = {},
  initialRunning = false,
  stateContainerRef,
}: EditorTileWrapperProps) {
  // Local state for files list (multi-file support not in store)
  const [files, setFiles] = useState<EditorFile[]>(initialFiles ?? createMockFiles());
  const [activeFileId, setActiveFileId] = useState<string | null>(
    initialActiveFile ?? files[0]?.id ?? null
  );
  const [envVars, setEnvVars] = useState<EnvVar[]>(initialEnvVars);
  const [output, setOutput] = useState(initialOutput);
  const [running, setRunning] = useState(initialRunning);
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [showEnvVars, setShowEnvVars] = useState(false);
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvValue, setNewEnvValue] = useState('');

  // Real store hook for editor tile content
  const { editorTile, editorTileActions, exists } = useEditorTile(TILE_ID, TAB_ID);
  const storeUpdateEditorTile = useStoreContext(state => state.updateEditorTile);

  const activeFile = files.find((f) => f.id === activeFileId);

  // Sync active file content with store
  useEffect(() => {
    if (activeFile && editorTileActions) {
      editorTileActions.setFileName(activeFile.name);
      editorTileActions.setContent(activeFile.content);
    }
  }, [activeFileId]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  const handleCreateFile = useCallback((name: string) => {
    const newFile: EditorFile = {
      id: `file-${Date.now()}`,
      name,
      content: '',
      type: 'file',
    };
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);
    
    // Update store with new file content
    if (editorTileActions) {
      editorTileActions.setFileName(name);
      editorTileActions.setContent('');
    }
    
    callbacks.onCreateFile?.(name);
  }, [callbacks, editorTileActions]);

  const handleDeleteFile = useCallback((id: string) => {
    setFiles((prev) => {
      const newFiles = prev.filter((f) => f.id !== id);
      if (activeFileId === id && newFiles.length > 0) {
        setActiveFileId(newFiles[0].id);
      }
      return newFiles;
    });
    callbacks.onDeleteFile?.(id);
  }, [activeFileId, callbacks]);

  const handleRenameFile = useCallback((id: string, newName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, name: newName } : f))
    );
    
    // Update store if renaming active file
    if (id === activeFileId && editorTileActions) {
      editorTileActions.setFileName(newName);
    }
    
    callbacks.onRenameFile?.(id, newName);
  }, [activeFileId, callbacks, editorTileActions]);

  const handleSelectFile = useCallback((id: string) => {
    const file = files.find(f => f.id === id);
    setActiveFileId(id);
    
    // Update store with selected file
    if (file && editorTileActions) {
      editorTileActions.setFileName(file.name);
      editorTileActions.setContent(file.content);
    }
    
    callbacks.onFileSelect?.(id);
  }, [files, callbacks, editorTileActions]);

  const handleUpdateContent = useCallback((id: string, content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, content } : f))
    );
    
    // Update store if updating active file
    if (id === activeFileId && editorTileActions) {
      editorTileActions.setContent(content);
    }
    
    callbacks.onContentChange?.(id, content);
  }, [activeFileId, callbacks, editorTileActions]);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setOutput('');
    
    // Simulate execution
    await new Promise((resolve) => setTimeout(resolve, 500));
    
    const result = `Output: ${activeFile?.content ?? 'No file selected'}`;
    setOutput(result);
    setRunning(false);
    callbacks.onRun?.(result);
  }, [activeFile, callbacks]);

  const handleAddEnvVar = useCallback((key: string, value: string) => {
    const newVars = [...envVars, { key, value }];
    setEnvVars(newVars);
    callbacks.onEnvVarChange?.(newVars);
  }, [envVars, callbacks]);

  // ==========================================================================
  // Expose state to test via ref (using shared hook)
  // ==========================================================================

  useStateContainer(stateContainerRef, () => ({
    getFiles: () => files,
    getActiveFile: () => activeFileId,
    getFileContent: (id: string) => files.find((f) => f.id === id)?.content ?? '',
    getEnvVars: () => envVars,
    getOutput: () => output,
    isRunning: () => running,
    createFile: handleCreateFile,
    deleteFile: handleDeleteFile,
    renameFile: handleRenameFile,
    selectFile: handleSelectFile,
    updateContent: handleUpdateContent,
    run: handleRun,
    addEnvVar: handleAddEnvVar,
  }), [files, activeFileId, envVars, output, running, handleCreateFile, handleDeleteFile, handleRenameFile, handleSelectFile, handleUpdateContent, handleRun, handleAddEnvVar]);

  // ==========================================================================
  // Render
  // ==========================================================================

  return (
    <div data-testid="editor-tile-container" className="bg-white border rounded-lg flex h-96">
      {/* File explorer */}
      <div className="w-48 border-r p-2" data-testid="file-explorer">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold">Files</span>
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 hover:bg-gray-100 rounded"
            data-testid="new-file-button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {/* New file input */}
        {isCreating && (
          <div className="mb-2" data-testid="new-file-form">
            <input
              type="text"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFileName.trim()) {
                  handleCreateFile(newFileName.trim());
                  setNewFileName('');
                  setIsCreating(false);
                }
                if (e.key === 'Escape') {
                  setIsCreating(false);
                  setNewFileName('');
                }
              }}
              placeholder="filename.ext"
              className="w-full px-2 py-1 text-sm border rounded"
              autoFocus
              data-testid="new-file-input"
            />
          </div>
        )}

        {/* File list */}
        <div className="space-y-1">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer group ${
                file.id === activeFileId ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
              }`}
              data-testid={`file-item-${file.id}`}
              data-active={file.id === activeFileId}
            >
              {renamingId === file.id ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && renameValue.trim()) {
                      handleRenameFile(file.id, renameValue.trim());
                      setRenamingId(null);
                    }
                    if (e.key === 'Escape') {
                      setRenamingId(null);
                    }
                  }}
                  onBlur={() => {
                    if (renameValue.trim()) {
                      handleRenameFile(file.id, renameValue.trim());
                    }
                    setRenamingId(null);
                  }}
                  className="flex-1 px-1 text-sm border rounded"
                  autoFocus
                  data-testid="rename-input"
                />
              ) : (
                <>
                  {file.type === 'folder' ? (
                    <Folder className="h-4 w-4 text-gray-400" />
                  ) : (
                    <File className="h-4 w-4 text-gray-400" />
                  )}
                  <button
                    className="flex-1 text-left text-sm truncate"
                    onClick={() => handleSelectFile(file.id)}
                    onDoubleClick={() => {
                      if (!file.readOnly) {
                        setRenamingId(file.id);
                        setRenameValue(file.name);
                      }
                    }}
                    data-testid={`file-button-${file.id}`}
                  >
                    {file.name}
                  </button>
                  {file.readOnly && (
                    <Lock className="h-3 w-3 text-gray-400" data-testid={`lock-icon-${file.id}`} />
                  )}
                  {!file.readOnly && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded"
                      data-testid={`delete-file-${file.id}`}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* Env vars toggle */}
        <div className="mt-4 pt-2 border-t">
          <button
            onClick={() => setShowEnvVars(!showEnvVars)}
            className="text-sm text-gray-600 hover:text-gray-900"
            data-testid="env-vars-toggle"
          >
            Environment Variables
          </button>
          {showEnvVars && (
            <div className="mt-2 space-y-1" data-testid="env-vars-panel">
              {envVars.map((v, i) => (
                <div key={i} className="text-xs bg-gray-50 px-2 py-1 rounded" data-testid={`env-var-${i}`}>
                  {v.key}={v.value}
                </div>
              ))}
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newEnvKey}
                  onChange={(e) => setNewEnvKey(e.target.value)}
                  placeholder="KEY"
                  className="w-1/2 px-1 py-0.5 text-xs border rounded"
                  data-testid="env-key-input"
                />
                <input
                  type="text"
                  value={newEnvValue}
                  onChange={(e) => setNewEnvValue(e.target.value)}
                  placeholder="value"
                  className="w-1/2 px-1 py-0.5 text-xs border rounded"
                  data-testid="env-value-input"
                />
              </div>
              <button
                onClick={() => {
                  if (newEnvKey.trim()) {
                    handleAddEnvVar(newEnvKey.trim(), newEnvValue);
                    setNewEnvKey('');
                    setNewEnvValue('');
                  }
                }}
                className="text-xs text-blue-500 hover:underline"
                data-testid="add-env-button"
              >
                Add
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 flex flex-col">
        {/* Editor header */}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="text-sm font-medium" data-testid="active-file-name">
            {activeFile?.name ?? 'No file selected'}
          </span>
          <button
            onClick={handleRun}
            disabled={running || !activeFile}
            className={`flex items-center gap-1 px-3 py-1 rounded text-sm ${
              running || !activeFile
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-green-500 text-white hover:bg-green-600'
            }`}
            data-testid="run-button"
          >
            {running ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {running ? 'Running...' : 'Run'}
          </button>
        </div>

        {/* Editor content */}
        <div className="flex-1 p-4" data-testid="editor-content">
          {activeFile ? (
            activeFile.readOnly ? (
              <div className="h-full">
                <div className="text-amber-600 text-sm mb-2" data-testid="readonly-warning">
                  This file is read-only
                </div>
                <pre className="text-sm font-mono bg-gray-50 p-2 rounded" data-testid="readonly-content">
                  {activeFile.content}
                </pre>
              </div>
            ) : (
              <textarea
                value={activeFile.content}
                onChange={(e) => handleUpdateContent(activeFile.id, e.target.value)}
                className="w-full h-full font-mono text-sm p-2 border rounded resize-none"
                placeholder="Write your code here..."
                data-testid="code-editor"
              />
            )
          ) : (
            <div className="text-gray-500 text-center" data-testid="no-file-message">
              Select a file to edit
            </div>
          )}
        </div>

        {/* Output panel */}
        {output && (
          <div className="border-t p-4" data-testid="output-panel">
            <div className="text-sm font-semibold mb-2">Output</div>
            <pre className="text-sm font-mono bg-gray-900 text-green-400 p-2 rounded" data-testid="output-content">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Main Export: renderEditorTile
// =============================================================================

export function renderEditorTile(options: EditorTileTestOptions = {}): EditorTileTestResult {
  const stateContainerRef: React.MutableRefObject<StateContainer | null> = { current: null };
  
  // Get initial content for store
  const initialFiles = options.initialFiles ?? createMockFiles();
  const initialActiveId = options.initialActiveFile ?? initialFiles[0]?.id;
  const initialContent = initialFiles.find(f => f.id === initialActiveId)?.content ?? '';
  
  const initialState = createInitialStoreState(initialContent);

  const renderResult = render(
    <StoreProvider initialState={initialState}>
      <EditorTileWrapper {...options} stateContainerRef={stateContainerRef} />
    </StoreProvider>
  );

  return {
    ...renderResult,
    getFiles: () => stateContainerRef.current?.getFiles() ?? [],
    getActiveFile: () => stateContainerRef.current?.getActiveFile() ?? null,
    getFileContent: (id) => stateContainerRef.current?.getFileContent(id) ?? '',
    getEnvVars: () => stateContainerRef.current?.getEnvVars() ?? [],
    getOutput: () => stateContainerRef.current?.getOutput() ?? '',
    isRunning: () => stateContainerRef.current?.isRunning() ?? false,
    createFile: (name) => {
      act(() => {
        stateContainerRef.current?.createFile(name);
      });
    },
    deleteFile: (id) => {
      act(() => {
        stateContainerRef.current?.deleteFile(id);
      });
    },
    renameFile: (id, name) => {
      act(() => {
        stateContainerRef.current?.renameFile(id, name);
      });
    },
    selectFile: (id) => {
      act(() => {
        stateContainerRef.current?.selectFile(id);
      });
    },
    updateContent: (id, content) => {
      act(() => {
        stateContainerRef.current?.updateContent(id, content);
      });
    },
    run: () => {
      act(() => {
        stateContainerRef.current?.run();
      });
    },
    addEnvVar: (key, value) => {
      act(() => {
        stateContainerRef.current?.addEnvVar(key, value);
      });
    },
  };
}
