# Interfaces Behavior Test Catalog

This document outlines all testable user behaviors for the Interfaces feature. Each behavior describes a user action and its expected outcome, organized by feature area and priority.

---

## Overview

| Priority  | Category                 | Behaviors | Status         | Test File                                |
| --------- | ------------------------ | --------- | -------------- | ---------------------------------------- |
| P1        | Log Table - Basic        | 12        | ✅ Complete    | `dataTable.browser.test.tsx`             |
| P1        | Log Table - Advanced     | 17        | ✅ Complete    | `dataTable.browser.test.tsx`             |
| P1        | Tab Management           | 8         | ✅ Complete    | `tabManagement.browser.test.tsx`         |
| P2        | Tile Layout              | 9         | ✅ Complete    | `tileLayout.browser.test.tsx`            |
| P2        | Edit Mode                | 5         | ✅ Complete    | `editMode.browser.test.tsx`              |
| P2        | Plot Tile                | 8         | ✅ Complete    | `plotTile.browser.test.tsx`              |
| P2        | Editor Tile              | 8         | ✅ Complete    | `editorTile.browser.test.tsx`            |
| P2        | Selection Panel          | 16        | ✅ Complete    | `selectionPanel.browser.test.tsx`        |
| P3        | Context Management       | 5         | ✅ Complete    | `contextManagement.browser.test.tsx`     |
| P3        | Checkpoints & Auto-Save  | 7         | ✅ Complete    | `checkpoints.browser.test.tsx`           |
| P3        | File Operations          | 5         | ✅ Complete    | `fileOperations.browser.test.tsx`        |
| P4        | Project Selection        | 5         | ✅ Complete    | `projectSelection.browser.test.tsx`      |
| P4        | Interface Selection      | 4         | ✅ Complete    | `interfaceSelection.browser.test.tsx`    |
| P4        | Sidebar Navigation       | 7         | ✅ Complete    | `sidebarNavigation.browser.test.tsx`     |
| P5        | Terminal Tile            | 5         | 🔴 Not Started | -                                        |
| P5        | Error Handling           | 6         | ✅ Complete    | `errorHandling.browser.test.tsx`         |
| P5        | Keyboard & Accessibility | 8         | ✅ Complete    | `keyboardAccessibility.browser.test.tsx` |
| **Total** |                          | **135**   | **130 tested** | 564 individual tests                     |

---

## P1: Critical User Flows

### A. Log Table - Basic (`dataTable.browser.test.tsx`) ✅

The log table is the primary data visualization component. Users spend most of their time here.

| ID  | Behavior              | Scenario                                    | Expected Outcome                                          | Status | Notes               |
| --- | --------------------- | ------------------------------------------- | --------------------------------------------------------- | ------ | ------------------- |
| A1  | Display logs          | Table loads with project data               | Rows render with correct values, columns visible          | ✅     | 4 tests             |
| A2  | Pagination - Next     | Click next page button                      | Next page loads, offset increases, page indicator updates | ⚠️     | State tested only\* |
| A3  | Pagination - Previous | Click prev page button                      | Previous page loads, offset decreases                     | ⚠️     | State tested only\* |
| A4  | Column sorting        | Click column header                         | Data reorders by column, sort indicator appears           | ✅     | 4 tests             |
| A5  | Column filtering      | Type filter value in column filter          | Rows filter to match, filter chip appears                 | ✅     | 4 tests             |
| A6  | Common search         | Type in global search bar                   | All visible columns searched, matching rows shown         | ✅     | 3 tests             |
| A7  | Column visibility     | Toggle column in visibility menu            | Column hides/shows in table                               | ✅     | 4 tests             |
| A8  | Column reorder        | Drag column header to new position          | Columns reorder, order persists                           | ✅     | 4 tests             |
| A9  | Cell selection        | Click on a cell                             | Cell highlights, selection panel shows cell data          | ✅     | 3 tests             |
| A10 | Metrics row toggle    | Toggle metrics visibility button            | Summary row appears/disappears                            | ✅     | 3 tests             |
| A11 | Metrics type change   | Change metric dropdown (mean/sum/count/etc) | Metrics recalculate with new aggregation                  | ✅     | 4 tests             |
| A12 | Refresh logs          | Click refresh button                        | Latest logs fetched, table updates                        | ✅     | 2 tests             |

> \*A2/A3 Note: Pagination button clicks are not tested because the pagination controls live in the parent `LogsTable` component, not in `DataTable`. The harness tests that `DataTable` correctly respects offset/pageSize configuration at the state level.

### B. Log Table - Advanced (`dataTable.browser.test.tsx`) ✅

Advanced table features for power users.

| ID  | Behavior                | Scenario                                 | Expected Outcome                              | Status | Notes   |
| --- | ----------------------- | ---------------------------------------- | --------------------------------------------- | ------ | ------- |
| B1  | Inline cell edit        | Double-click editable cell, type, blur   | Cell value updates, persists to server        | ✅     | 3 tests |
| B2  | Inline edit - immutable | Double-click immutable cell              | Toast shows "field is immutable", no edit     | ✅     | 1 test  |
| B3  | Cell deletion           | Select cells, press Delete/Backspace     | Confirmation dialog, cells deleted            | ✅     | 2 tests |
| B4  | Multi-select - Ctrl     | Ctrl+click multiple cells                | Multiple cells selected                       | ✅     | 1 test  |
| B5  | Multi-select - Shift    | Shift+click or drag                      | Range of cells selected                       | ✅     | 1 test  |
| B6  | Column grouping         | Drag column to group zone                | Table groups by column, shows group headers   | ✅     | 2 tests |
| B7  | Group expansion         | Click expand arrow on group row          | Group expands showing child rows              | ✅     | 3 tests |
| B8  | Group collapse          | Click collapse arrow on expanded group   | Group collapses, children hidden              | ✅     | 2 tests |
| B9  | Group sorting           | Click group header sort                  | Groups reorder by aggregate value             | ✅     | 1 test  |
| B10 | Freeze logs             | Click freeze button                      | Logs frozen at current timestamp              | ✅     | 3 tests |
| B11 | Unfreeze logs           | Click freeze button again                | Live logs resume                              | ✅     | 2 tests |
| B12 | Column pinning          | Drag column to pin zone (left/right)     | Column pins to edge, stays visible on scroll  | ✅     | 2 tests |
| B13 | Cell copy               | Click copy button in expanded cell       | Cell content copied to clipboard              | ✅     | 3 tests |
| B14 | Cell popover            | Click expand icon on cell                | Popover shows full cell content with markdown | ✅     | 2 tests |
| B15 | Derived column create   | Click +, select "Derived", enter formula | New column appears with calculated values     | ✅     | 1 test  |
| B16 | Derived column edit     | Edit formula of existing column          | Values recalculate immediately                | ✅     | 1 test  |
| B17 | Bulk delete             | Select multiple cells, delete            | All selected cells cleared/deleted            | ✅     | 2 tests |

### C. Tab Management (`tabManagement.browser.test.tsx`) ✅

Tabs organize tiles within an interface. Users switch between tabs frequently.

| ID  | Behavior      | Scenario                             | Expected Outcome                                          | Status | Notes   |
| --- | ------------- | ------------------------------------ | --------------------------------------------------------- | ------ | ------- |
| C1  | Switch tabs   | Click tab in sidebar                 | Tab content loads, URL query param updates                | ✅     | 4 tests |
| C2  | Create tab    | Click + button, enter name, submit   | Dialog closes, new tab appears in sidebar, becomes active | ✅     | 5 tests |
| C3  | Rename tab    | Double-click tab name, edit, blur    | Name updates in sidebar and persists                      | ✅     | 3 tests |
| C4  | Delete tab    | Click delete icon, confirm in dialog | Tab removed, redirects to another tab                     | ✅     | 3 tests |
| C5  | Tab reorder   | Drag tab to new position in sidebar  | Order updates, persists on refresh                        | ✅     | 3 tests |
| C6  | Tab color     | Open color picker, select color      | Tab header/accent updates to color                        | ✅     | 2 tests |
| C7  | Tab icon      | Open icon picker, select icon        | Tab shows icon in sidebar                                 | ✅     | 3 tests |
| C8  | Duplicate tab | Click duplicate in tab menu          | New tab created with "\_copy" suffix                      | ✅     | 2 tests |

---

## P2: Layout & Tiles

### D. Tile Layout (`tileLayout.browser.test.tsx`) ✅

Tiles are arranged in a grid. Layout editing is a core feature.

| ID  | Behavior         | Scenario                                | Expected Outcome                                  | Status | Notes   |
| --- | ---------------- | --------------------------------------- | ------------------------------------------------- | ------ | ------- |
| D1  | Add tile         | Click "Add Tile" button                 | New tile overlay appears, tile added to grid      | ✅     | 3 tests |
| D2  | Select tile type | Click tile type in new tile overlay     | Tile renders as Table/Plot/Terminal               | ✅     | 2 tests |
| D3  | Move tile        | Enter edit mode, drag tile by handle    | Tile moves to new position, collision prevention  | ✅     | 2 tests |
| D4  | Resize tile      | Enter edit mode, drag resize handle     | Tile resizes, respects minW/minH                  | ✅     | 3 tests |
| D5  | Hide tile        | Click hide button on tile header        | Tile disappears from grid, appears in hidden list | ✅     | 3 tests |
| D6  | Show hidden tile | Click restore on hidden tile in sidebar | Tile reappears in grid                            | ✅     | 2 tests |
| D7  | Clone tile       | Click clone button on tile header       | Duplicate tile created with "\_copy" suffix       | ✅     | 2 tests |
| D8  | Delete tile      | Click delete, confirm in dialog         | Tile removed from grid permanently                | ✅     | 2 tests |
| D9  | Tile color       | Open color picker in tile header        | Tile accent color changes                         | ✅     | 2 tests |

### E. Edit Mode (`editMode.browser.test.tsx`) ✅

Edit mode enables layout modifications and shows save/reset controls.

| ID  | Behavior                  | Scenario                                  | Expected Outcome                                  | Status | Notes                     |
| --- | ------------------------- | ----------------------------------------- | ------------------------------------------------- | ------ | ------------------------- |
| E1  | Toggle edit mode          | Click edit button in sidebar              | Drag handles appear, action buttons show on tiles | ✅     | Hammer icon toggles       |
| E2  | Unsaved changes indicator | Make layout change                        | Visual indicator shows unsaved state              | ✅     | Dot or asterisk           |
| E3  | Unsaved changes warning   | Try to navigate away with unsaved changes | Warning dialog appears with save/discard options  | ✅     | Browser beforeunload also |
| E4  | Save changes              | Click save button                         | Changes persist to backend, success toast shows   | ✅     | Loading state during save |
| E5  | Reset changes             | Click reset button, confirm               | All changes since last save reverted              | ✅     | Confirmation dialog       |

### F. Plot Tile (`plotTile.browser.test.tsx`) ✅

Visualization tile for charting log data.

| ID  | Behavior         | Scenario                             | Expected Outcome                         | Status | Notes                  |
| --- | ---------------- | ------------------------------------ | ---------------------------------------- | ------ | ---------------------- |
| F1  | Plot renders     | Plot tile loads with data            | Chart displays with axes and data points | ✅     | D3-based rendering     |
| F2  | Hover data point | Hover over point on chart            | Tooltip shows data values                | ✅     | Follows cursor         |
| F3  | Plot settings    | Open settings sidebar                | Configuration options appear             | ✅     | X/Y axis, colors, etc. |
| F4  | Change X axis    | Select different column for X axis   | Plot re-renders with new axis            | ✅     | Updates immediately    |
| F5  | Change Y axis    | Select different column for Y axis   | Plot re-renders with new axis            | ✅     | Updates immediately    |
| F6  | Plot type        | Change chart type (scatter/line/bar) | Visualization changes                    | ✅     | Dropdown selection     |
| F7  | Color by column  | Select column for color encoding     | Points colored by value                  | ✅     | Legend appears         |
| F8  | Focus mode       | Click expand button                  | Plot opens in focus pane (full screen)   | ✅     | ESC to close           |

### G. Editor Tile (`editorTile.browser.test.tsx`) ✅

Interactive code editor and file manager.

| ID  | Behavior        | Scenario                            | Expected Outcome                           | Status | Notes                      |
| --- | --------------- | ----------------------------------- | ------------------------------------------ | ------ | -------------------------- |
| G1  | Create file     | Click new file button, name it      | File appears in explorer, opens in editor  | ✅     | Support folder creation    |
| G2  | Edit code       | Type in editor                      | Content updates, unsaved indicator         | ✅     | Monaco editor interactions |
| G3  | Run code        | Click run button                    | Script executes, output panel shows result | ✅     | CodeSandbox backend        |
| G4  | Env vars        | Add/edit environment variable       | Updates `.env` file, used in execution     | ✅     | Secret management UI       |
| G5  | Delete file     | Click delete icon on file           | File removed from explorer                 | ✅     | Confirmation               |
| G6  | Rename file     | Double-click file in explorer       | Name updates, references updated           | ✅     |                            |
| G7  | File navigation | Click file in explorer              | Editor content switches to file            | ✅     | Active tab highlighting    |
| G8  | Read-only mode  | Open file without write permissions | Editor prevents typing, shows warning      | ✅     |                            |

### H. Selection Panel (`selectionPanel.browser.test.tsx`) ✅

Panel showing details of selected cells/rows with specialized views.

| ID  | Behavior             | Scenario                     | Expected Outcome                     | Status | Notes                        |
| --- | -------------------- | ---------------------------- | ------------------------------------ | ------ | ---------------------------- |
| H1  | Show selection       | Select cell in table         | Selection panel shows cell data      | ✅     | Right side panel             |
| H2  | Multiple selections  | Select multiple cells        | Panel shows all selected items       | ✅     | Accordion layout             |
| H3  | Expand entry         | Click expand arrow on entry  | Entry expands showing nested data    | ✅     | Recursive for nested objects |
| H4  | Collapse entry       | Click collapse arrow         | Entry collapses                      | ✅     | Persists expand state        |
| H5  | Expand all           | Click "Expand All" button    | All entries expand                   | ✅     | Global toggle                |
| H6  | Collapse all         | Click "Collapse All" button  | All entries collapse                 | ✅     | Global toggle                |
| H7  | View mode - Raw      | Select Raw view mode         | Shows raw JSON                       | ✅     | Dropdown in panel header     |
| H8  | View mode - Markdown | Select Markdown view mode    | Renders as markdown                  | ✅     | For text content             |
| H9  | View mode - Trace    | Select trace data cell       | Timeline view renders with spans     | ✅     | Gantt chart visualization    |
| H10 | View mode - Chat     | Select chat history cell     | Chat UI renders with bubbles         | ✅     | User/Assistant separation    |
| H11 | View mode - Image    | Select base64 image string   | Image renders                        | ✅     | Click to expand              |
| H12 | View mode - Diff     | Select two cells (Diff mode) | Visual diff shows added/removed text | ✅     | Comparison view              |
| H13 | Reorder entries      | Drag entry to new position   | Entries reorder in panel             | ✅     | DnD reordering               |
| H14 | Audio playback       | Select audio data cell       | Audio player renders and plays       | ✅     | Play/pause controls          |
| H15 | PDF rendering        | Select PDF data cell         | PDF viewer renders document          | ✅     | Scrollable                   |
| H16 | Matrix view          | Select matrix/tensor data    | Grid visualization renders           | ✅     | Heatmap style                |

---

## P3: State & Contexts

### I. Context Management (`contextManagement.browser.test.tsx`) ✅

Contexts filter data across tiles. They can be set globally or per-tile.

| ID  | Behavior            | Scenario                              | Expected Outcome                               | Status | Notes                           |
| --- | ------------------- | ------------------------------------- | ---------------------------------------------- | ------ | ------------------------------- |
| I1  | Set global context  | Select context in sidebar dropdown    | All tiles update to show context-filtered data | ✅     | Interface-level context         |
| I2  | Set tile context    | Select context in tile menu           | Only that tile updates, others unchanged       | ✅     | Tile-level override             |
| I3  | Create context      | Open context manager, create new      | New context appears in all context dropdowns   | ✅     | API creates context             |
| I4  | Context inheritance | Set tab context, check tile           | Tile inherits tab context unless overridden    | ✅     | Cascade: interface → tab → tile |
| I5  | Clear context       | Click clear/reset on context selector | Context removed, shows all data                | ✅     | Returns to no filter            |

### J. Checkpoints & Auto-Save (`checkpoints.browser.test.tsx`) ✅

The system uses optimistic auto-save for all changes, with manual checkpoints for save/reset.

**Architecture:**

- **Auto-save (optimistic)**: Every tile change (move, resize, add, remove) is immediately synced to Orchestra
- **Save Tab (checkpoint)**: Creates a named snapshot that can be restored to via `checkpointById()`
- **Reset Tab (restore)**: Reverts all changes back to the last checkpoint via `restoreTabWithTilesMutation`

| ID  | Behavior                  | Scenario                             | Expected Outcome                                    | Status | Notes                                  |
| --- | ------------------------- | ------------------------------------ | --------------------------------------------------- | ------ | -------------------------------------- |
| J1  | Save checkpoint           | Click "Save Tab" button              | Checkpoint created with timestamp and description   | ✅     | `useSaveTabWithTilesQuery`             |
| J2  | Restore checkpoint        | Click "Reset Tab", confirm in dialog | Interface/tab/tiles revert to checkpoint state      | ✅     | `useRestoreLastSavedTabWithTilesQuery` |
| J3  | Auto-save tile move       | Drag tile to new position            | Position auto-saved to Orchestra immediately        | ✅     | `updateTileMutation` in `useTabSync`   |
| J4  | Auto-save tile resize     | Resize tile via drag handle          | Size auto-saved to Orchestra immediately            | ✅     | `updateTileMutation` in `useTabSync`   |
| J5  | Auto-save tile add        | Add new tile to grid                 | Tile auto-saved to Orchestra immediately            | ✅     | `createTileMutation` in `useTabSync`   |
| J6  | Auto-save tile remove     | Delete tile from grid                | Deletion auto-saved to Orchestra immediately        | ✅     | `deleteTileMutation` in `useTabSync`   |
| J7  | Unsaved changes indicator | Make change after checkpoint         | Shows "Unsaved changes" relative to last checkpoint | ✅     | Compares current state to checkpoint   |

**Not Implemented:**

- Multiple named checkpoints (only single "last save" exists)
- Export/import templates as JSON files

### K. File Operations (`fileOperations.browser.test.tsx`) ✅

File upload and data import features.

| ID  | Behavior            | Scenario                           | Expected Outcome               | Status | Notes               |
| --- | ------------------- | ---------------------------------- | ------------------------------ | ------ | ------------------- |
| K1  | Open upload dialog  | Click upload button                | File upload dialog appears     | ✅     | Drag-drop zone      |
| K2  | Upload CSV          | Drop/select CSV file               | File parsed, preview shown     | ✅     | Column mapping UI   |
| K3  | Upload JSONL        | Drop/select JSONL file             | File parsed, preview shown     | ✅     | Line-by-line JSON   |
| K4  | Column type mapping | Set param vs entry for each column | Types applied on import        | ✅     | Dropdown per column |
| K5  | Submit upload       | Click upload after configuration   | Data imported, table refreshes | ✅     | Progress indicator  |

---

## P4: Project & Interface Selection

### L. Project Selection (`projectSelection.browser.test.tsx`) ✅

Entry point to the interfaces feature. Users select which project to view.

| ID  | Behavior        | Scenario                        | Expected Outcome                          | Status | Notes                      |
| --- | --------------- | ------------------------------- | ----------------------------------------- | ------ | -------------------------- |
| L1  | List projects   | Open project selector           | All user projects shown in list           | ✅     | Sorted alphabetically      |
| L2  | Select project  | Click project in list           | Interface loads, URL updates with project | ✅     | Remembers last interface   |
| L3  | Create project  | Click create, fill form, submit | New project created, becomes selected     | ✅     | Navigates to new interface |
| L4  | Search projects | Type in search input            | List filters to matching projects         | ✅     | Case-insensitive           |
| L5  | Delete project  | Click delete, confirm           | Project removed, redirects to another     | ✅     | Cannot undo                |

### M. Interface Selection (`interfaceSelection.browser.test.tsx`) ✅

Within a project, users can have multiple interfaces.

| ID  | Behavior         | Scenario                                | Expected Outcome                      | Status | Notes                       |
| --- | ---------------- | --------------------------------------- | ------------------------------------- | ------ | --------------------------- |
| M1  | List interfaces  | View sidebar after project selected     | Interfaces for current project shown  | ✅     | Collapsible sections        |
| M2  | Switch interface | Click different interface in sidebar    | Interface loads, tabs update          | ✅     | Preserves project selection |
| M3  | Create interface | Click create, name it, submit           | New interface created, becomes active | ✅     | Default tab created         |
| M4  | Delete interface | Click delete in interface menu, confirm | Interface removed                     | ✅     | Redirects to another        |

### N. Sidebar Navigation (`sidebarNavigation.browser.test.tsx`) ✅

The sidebar provides navigation and controls.

| ID  | Behavior                | Scenario                           | Expected Outcome                       | Status | Notes                      |
| --- | ----------------------- | ---------------------------------- | -------------------------------------- | ------ | -------------------------- |
| N1  | Collapse sidebar        | Click collapse button              | Sidebar collapses to icons only        | ✅     | Cookie persists state      |
| N2  | Expand sidebar          | Click expand button when collapsed | Sidebar expands to full width          | ✅     | Smooth animation           |
| N3  | Resize sidebar          | Drag sidebar edge                  | Sidebar resizes, respects min/max      | ✅     | Width persists in cookie   |
| N4  | Hide sidebar completely | Drag past threshold                | Sidebar fully hidden                   | ✅     | Only expand button visible |
| N5  | Add to favorites        | Star an interface                  | Interface appears in favorites section | ✅     | Persists across sessions   |
| N6  | Remove from favorites   | Unstar an interface                | Interface removed from favorites       | ✅     |                            |
| N7  | Favorites section       | View favorites in sidebar          | Favorited interfaces shown at top      | ✅     | Quick access               |

---

## P5: Specialized Features

### O. Terminal Tile (`terminalTile.browser.test.tsx`)

Interactive terminal for code execution.

| ID  | Behavior       | Scenario                   | Expected Outcome                 | Notes                |
| --- | -------------- | -------------------------- | -------------------------------- | -------------------- |
| O1  | Terminal loads | Terminal tile renders      | Xterm.js terminal appears        | CodeSandbox backed   |
| O2  | Type command   | Type in terminal           | Characters appear in terminal    | Real input handling  |
| O3  | Run command    | Press Enter after command  | Command executes, output shown   | API execution        |
| O4  | Shell type     | Change shell type dropdown | Terminal restarts with new shell | bash/zsh/fish        |
| O5  | Focus mode     | Click expand button        | Terminal opens in focus pane     | Full screen terminal |

### P. Error Handling (`errorHandling.browser.test.tsx`) ✅

Graceful handling of failures and edge cases.

| ID  | Behavior            | Scenario                     | Expected Outcome                                     | Status | Notes                 |
| --- | ------------------- | ---------------------------- | ---------------------------------------------------- | ------ | --------------------- |
| P1  | API failure - logs  | Logs API returns 500 error   | Error message shown in table, retry button available | ✅     | Toast notification    |
| P2  | API failure - save  | Save operation fails         | Error toast, state not cleared                       | ✅     | Retry available       |
| P3  | Empty state         | Project has no logs          | Empty state illustration with helpful message        | ✅     | Action to upload data |
| P4  | Loading timeout     | API takes > 10 seconds       | Timeout message shown, option to retry               | ✅     | Spinner during load   |
| P5  | Optimistic rollback | Inline edit fails on backend | UI reverts to previous state, error toast shown      | ✅     | No data loss          |
| P6  | Network offline     | Network disconnects          | Offline indicator, queued changes                    | ✅     | Reconnect handling    |

### Q. Keyboard & Accessibility (`keyboardAccessibility.browser.test.tsx`) ✅

Keyboard navigation and accessibility features.

| ID  | Behavior             | Scenario                         | Expected Outcome                 | Status | Notes                     |
| --- | -------------------- | -------------------------------- | -------------------------------- | ------ | ------------------------- |
| Q1  | Arrow key navigation | Press arrow keys in table        | Selection moves to adjacent cell | ✅     | Documented in hints       |
| Q2  | Escape to deselect   | Press Escape with selection      | All selections cleared           | ✅     | Universal deselect        |
| Q3  | Delete key           | Press Delete with cells selected | Delete confirmation dialog       | ✅     | Backspace also works      |
| Q4  | Tab navigation       | Tab through focusable elements   | Focus moves in logical order     | ✅     | Accessibility requirement |
| Q5  | Enter to expand      | Press Enter on grouped row       | Group expands                    | ✅     | Alternative to click      |
| Q6  | Ctrl+S to save       | Press Ctrl+S in edit mode        | Save dialog opens                | ✅     | Common shortcut           |
| Q7  | Ctrl+Z to undo       | Press Ctrl+Z after edit          | Edit undone                      | ✅     | Undo stack                |
| Q8  | Screen reader        | Navigate with screen reader      | All content accessible           | ✅     | ARIA labels               |

---

## Testing Approach

| Harness                             | Real Component | Real Store | Notes                                                                   |
| ----------------------------------- | -------------- | ---------- | ----------------------------------------------------------------------- |
| `dataTableTestHarness.tsx`          | ✅ Yes         | ✅ Yes     | Uses real TanStack Table with Zustand                                   |
| `tabSidebarTestHarness.tsx`         | ✅ Yes         | ✅ Yes     | **Real TabList component** from Nav/                                    |
| `tileGridTestHarness.tsx`           | Mock UI        | ✅ Yes     | Real `useTilesFromTab` hook                                             |
| `editModeTestHarness.tsx`           | Mock UI        | ✅ Yes     | Real `useGlobalUIMode`, real mutation hooks                             |
| `checkpointTestHarness.tsx`         | Mock UI        | ✅ Yes     | Real `useSaveTabWithTilesQuery`, `useRestoreLastSavedTabWithTilesQuery` |
| `contextSelectorTestHarness.tsx`    | Mock UI        | ✅ Yes     | Real context inheritance via `getEffectiveContext`                      |
| `fileUploadTestHarness.tsx`         | ✅ Yes         | ✅ Yes     | **Real FileUpload component** with react-dropzone and Papa.parse        |
| `selectionPanelTestHarness.tsx`     | Mock UI        | ✅ Yes     | Real selection state management                                         |
| `editorTileTestHarness.tsx`         | Mock UI        | ✅ Yes     | Real `useEditorTile` hook                                               |
| `plotTileTestHarness.tsx`           | Mock UI        | ✅ Yes     | Real plot state management                                              |
| `projectSelectionTestHarness.tsx`   | ✅ Yes         | ✅ Yes     | **Real ProjectPicker component** from Nav/                              |
| `interfaceSelectionTestHarness.tsx` | ✅ Yes         | ✅ Yes     | **Real InterfacePicker component** from Nav/                            |
| `sidebarNavigationTestHarness.tsx`  | Mock UI        | ✅ Yes     | Real favorites state                                                    |
| `errorHandlingTestHarness.tsx`      | Mock UI        | ✅ Yes     | Real error state management                                             |

**Key Points:**

- All harnesses use the **real Zustand store** for state management
- Navigation harnesses (ProjectPicker, InterfacePicker, TabList) now use **real extracted components**
- Harnesses marked "Mock UI" render simplified test UI but call real store actions
- The store's business logic (context inheritance, checkpoint management, etc.) is fully tested
- API calls are mocked via React Query to avoid network dependencies

**Extracted Navigation Components (from InterfaceNav.tsx):**

- `src/components/Pages/Interfaces/Interface/Nav/ProjectPicker.tsx` - Project selection dropdown
- `src/components/Pages/Interfaces/Interface/Nav/InterfacePicker.tsx` - Interface selection dropdown
- `src/components/Pages/Interfaces/Interface/Nav/TabList.tsx` - Sortable tab list with DnD
- `src/components/Pages/Interfaces/Interface/Nav/utils.tsx` - Shared utilities (renderSidebarIcon)

---

## Test File Structure

```
src/tests/interfaces/behavior/
├── BEHAVIORS.md                              # This document
├── fixtures/
│   ├── checkpointTestHarness.tsx             # Checkpoint/save/reset harness ✅
│   ├── contextSelectorTestHarness.tsx        # Context management harness ✅
│   ├── dataTableTestHarness.tsx              # DataTable test harness ✅
│   ├── editModeTestHarness.tsx               # Edit mode harness ✅
│   ├── editorTileTestHarness.tsx             # Editor tile harness ✅
│   ├── errorHandlingTestHarness.tsx          # Error handling harness ✅
│   ├── fileUploadTestHarness.tsx             # File upload harness ✅
│   ├── interfaceSelectionTestHarness.tsx     # Interface selection harness ✅
│   ├── plotTileTestHarness.tsx               # Plot tile harness ✅
│   ├── projectSelectionTestHarness.tsx       # Project selection harness ✅
│   ├── selectionPanelTestHarness.tsx         # Selection panel harness ✅
│   ├── sidebarNavigationTestHarness.tsx      # Sidebar navigation harness ✅
│   ├── tabSidebarTestHarness.tsx             # Tab sidebar harness ✅
│   └── tileGridTestHarness.tsx               # Tile grid harness ✅
│
├── log-table/
│   ├── dataTable.browser.test.tsx            # A+B: Log table basic & advanced ✅
│   └── tabManagement.browser.test.tsx        # C: Tab CRUD ✅
│
├── tiles/
│   ├── tileLayout.browser.test.tsx           # D: Tile grid layout ✅
│   ├── editMode.browser.test.tsx             # E: Edit mode controls ✅
│   ├── plotTile.browser.test.tsx             # F: Plot visualization ✅
│   ├── editorTile.browser.test.tsx           # G: Editor & files ✅
│   ├── selectionPanel.browser.test.tsx       # H: Selection & views ✅
│   ├── selectionPanel.integration.browser.test.tsx  # H: Integration tests ✅
│   └── computeDiff.node.test.ts              # Diff computation unit tests ✅
│
├── state/
│   ├── contextManagement.browser.test.tsx    # I: Context selection ✅
│   ├── checkpoints.browser.test.tsx          # J: Checkpoints & auto-save ✅
│   └── fileOperations.browser.test.tsx       # K: File upload ✅
│
├── navigation/
│   ├── projectSelection.browser.test.tsx     # L: Project picker ✅
│   ├── interfaceSelection.browser.test.tsx   # M: Interface switcher ✅
│   └── sidebarNavigation.browser.test.tsx    # N: Sidebar controls ✅
│
├── accessibility/
│   ├── keyboardAccessibility.browser.test.tsx # Q: Keyboard & a11y ✅
│   └── errorHandling.browser.test.tsx        # P: Error states ✅
│
└── benchmarks/
    └── tileGrid.perf.browser.test.tsx        # Performance benchmarks ✅
```

### Not Yet Implemented

```
└── accessibility/
    └── terminalTile.browser.test.tsx         # O: Terminal interactions 🔴
```
