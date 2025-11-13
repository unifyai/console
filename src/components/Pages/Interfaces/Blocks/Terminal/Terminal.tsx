"use client";

import { useEffect, useRef, useState } from "react";
import {
  LogsActions,
  FieldsActions,
  ContextActions,
  CodeActions,
  GranularTileActions,
  ProjectsActions,
  FileActions,
} from "@/types/interfaces/grid";
// @ts-ignore library types can be brought in via @types/xterm
import { Terminal as XTerm } from "@xterm/xterm";
// @ts-ignore
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { useTiles } from "@/contexts/hooks/useStore";
import { useTerminalTileSync } from "@/contexts/hooks/tile/sync";
import { useTabData } from "@/contexts/hooks/tab/useTabData";
import BaseDropdown from "@/components/Common/Dropdowns/Base";
import ActionButton from "@/components/Common/Buttons/Action";
import { DropdownMenuItem } from "@/components/UI/dropdown-menu";
import { Play, Square, Maximize2 } from "lucide-react";
import { useTab } from "@/contexts/hooks/tab";
import { useGlobalUIMode } from "@/contexts/hooks/useGlobalUIMode";
import { useStoreContext } from "@/contexts/providers/StoreProvider";

interface TerminalProps {
  tileId: string;
  tabId: string;
  interfaceId: string;
  projectId: string;
  tileActions: GranularTileActions;
  projectsActions: ProjectsActions;
  logsActions: LogsActions;
  fieldsActions: FieldsActions;
  contextActions: ContextActions;
  codeActions: CodeActions;
  fileActions: FileActions;
}

/**
 * Interactive terminal tile based on CodeSandbox Terminals API and xterm-js.
 */
export default function Terminal({ 
  tileId,
  tabId,
  interfaceId,
  projectId,
  codeActions,
  fileActions,
  tileActions,
  projectsActions,
  contextActions,
  logsActions,
  fieldsActions
 }: TerminalProps) {

  const { terminalTile: terminalTileState, terminalTileActions } = useTerminalTileSync(
      tileId,
      tabId,
      tileActions,
      projectsActions,
      contextActions,
      logsActions,
      fieldsActions
  );
  const { data: tabData } = useTabData(tabId, interfaceId);
  const tileIds = tabData?.tileIds;
  const tiles = useTiles(tileIds, ["type", "terminalTile.shell_type"]);
  const terminalTiles = tiles.filter((tile) => tile.type == "Terminal");

  // Focus pane button support
  const { ui: tabUIState, uiActions: tabUIActions } = useTab(tabId);
  const setFocusPaneOpen = useStoreContext(state => state.setFocusPaneOpen);
  const focusPaneOpen = useStoreContext(state=>state.focusPaneOpen);
  
  // Get global UI mode settings
  const { isEditMode } = useGlobalUIMode();


  /* -------------------------------------------------- state / refs */
  const [started, setStarted] = useState(false);
  const [shell, setShell] = useState(terminalTileState?.shell_type || "bash");
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<string>("");
  const termRef = useRef<XTerm>();
  const fitRef = useRef<FitAddon>();
  const sessionId = useRef<string>();
  const pendingEnterRef = useRef<boolean>(false);
  const historyRef = useRef<string[]>([]);
  const histIdxRef = useRef<number>(-1); // -1 means current input
  const pendingTabRef = useRef<boolean>(false);
  const preTabBufferRef = useRef<string>("");
  const pendingBackspaceRef = useRef<boolean>(false);

  /* -------------------------------------------------- helper to init terminal */
  const initTerminal = async () => {
    if (started) return;

    /* xterm setup */
    const term = new XTerm({
      fontFamily: "var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, \"DejaVu Sans Mono\", monospace",
      theme: { background: "#1e1e1e" },
      cursorBlink: true,
      // Prevent descenders/underscores from being clipped by providing extra vertical room
      lineHeight: 1.5,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current!);
    fit.fit();
    term.focus();
    termRef.current = term;
    fitRef.current = fit;
    setStarted(true);

    // Ensure Tab key stays in the terminal and doesn't move browser focus
    term.attachCustomKeyEventHandler((ev: KeyboardEvent) => {
      if (ev.key === "Tab") {
        ev.preventDefault();
        return true; // allow xterm to emit onData("\t")
      }
      return true;
    });

    const resizeObserver = new ResizeObserver(() => fit.fit());
    resizeObserver.observe(containerRef.current!);

    try {
      // @ts-ignore global actions
      if (projectId.includes("Assistants")) {
        term.write("Syncing GDrives and starting terminal...\r\n");
      } else {
        term.write("Starting terminal...\r\n");
      }
      const { session_id } = await codeActions.createTerminal(shell, projectId);
      term.reset();
      sessionId.current = session_id;
    } catch {
      term.reset();
      term.write("Failed to start terminal session\r\n");
    }

    // Local buffer + send on Enter (basic behavior)
    term.onData(async (data: string) => {
      if (!sessionId.current || !termRef.current) return;

      // Strip xterm bracketed paste markers from local buffer to avoid prompt corruption
      // \x1b[200~ ... \x1b[201~
      let ch = data.replace(/\x1b\[200~/g, '').replace(/\x1b\[201~/g, '');
      if (!ch) return;

      // Enter: send the buffered command plus newline; do not echo locally
      if (ch === "\r") {
        const cmd = preTabBufferRef.current + bufferRef.current;
        bufferRef.current = "";

        // Move to a new line locally so the prompt/output starts at column 0
        term.write("\r\n");

        // Block rclone usage
        const isBlocked = cmd.trim().toLowerCase().includes("rclone");
        if (isBlocked) {
          term.write("rclone is not allowed\r\n");
        }

        if (!isBlocked) {
          const trimmed = cmd.trim();
          if (trimmed.length) {
            historyRef.current.push(trimmed);
          }
        }
        await codeActions.runTerminal(sessionId.current, isBlocked ? "\n" : cmd.replace(preTabBufferRef.current, "") + "\n");
        preTabBufferRef.current = "";
        pendingEnterRef.current = true;
        histIdxRef.current = -1; // reset browsing index
        return;
      }

      // Backspace: update local buffer and visually erase one char
      if (ch === "\u007F") {
        if (bufferRef.current.length > 0) {
          bufferRef.current = bufferRef.current.slice(0, -1);
          const term = termRef.current;
          const cursorX = term?.buffer?.active?.cursorX ?? 0;
          if (cursorX > 0) {
            term.write("\b \b");
          } else {
            // Wrapped to previous row: move up a line and to the last column, then erase
            term.write("\x1b[A");
            term.write(`\x1b[${term.cols}C`);
            term.write(" ");
            term.write(`\x1b[${term.cols}C`);
          }
        } else if (preTabBufferRef.current.length > 0) {
          preTabBufferRef.current = preTabBufferRef.current.slice(0, -1);
          const term = termRef.current;
          const cursorX = term?.buffer?.active?.cursorX ?? 0;
          if (cursorX > 0) {
            term.write("\b \b");
          } else {
            // Wrapped to previous row: move up a line and to the last column, then erase
            term.write("\x1b[A");
            term.write(`\x1b[${term.cols}C`);
            term.write(" ");
            term.write(`\x1b[${term.cols}C`);
          }
          pendingBackspaceRef.current = true;
          await codeActions.runTerminal(sessionId.current, ch);
        }
        return;
      }

      // Helper to erase the current buffer from the screen honoring wraps
      const eraseCurrentBuffer = () => {
        const len = bufferRef.current.length;
        if (!len) return;
        const t = termRef.current;
        if (!t) return;
        for (let i = 0; i < len; i++) {
          const cursorX = t.buffer?.active?.cursorX ?? 0;
          if (cursorX > 0) {
            t.write("\b \b");
          } else {
            t.write("\x1b[A");
            t.write(`\x1b[${t.cols}C`);
            t.write(" ");
            t.write(`\x1b[${t.cols}C`);
          }
        }
      };

      // History: Up arrow
      if (ch === "\u001b[A") {
        const hist = historyRef.current;
        if (!hist.length) return;
        if (histIdxRef.current === -1) {
          histIdxRef.current = hist.length - 1;
        } else if (histIdxRef.current > 0) {
          histIdxRef.current -= 1;
        }
        eraseCurrentBuffer();
        bufferRef.current = hist[histIdxRef.current] ?? "";
        term.write(bufferRef.current);
        return;
      }

      // History: Down arrow
      if (ch === "\u001b[B") {
        const hist = historyRef.current;
        if (!hist.length) return;
        if (histIdxRef.current === -1) return; // already at current input
        if (histIdxRef.current < hist.length - 1) {
          histIdxRef.current += 1;
          eraseCurrentBuffer();
          bufferRef.current = hist[histIdxRef.current] ?? "";
          term.write(bufferRef.current);
        } else {
          // Move back to empty current input
          histIdxRef.current = -1;
          eraseCurrentBuffer();
          bufferRef.current = "";
        }
        return;
      }

      // Tab: trigger shell completion; send only a tab and reconcile echo on poll
      if (ch === "\t") {
        preTabBufferRef.current += bufferRef.current;
        pendingTabRef.current = true;
        await codeActions.runTerminal(sessionId.current, bufferRef.current + "\t");
        return;
      }

      // Normal character: append to buffer and echo locally
      bufferRef.current += ch;
      term.write(ch);
    });
  };

  const stopTerminal = async () => {
    termRef.current?.reset();
    if (projectId.includes("Assistants")) {
      termRef.current?.write("Syncing GDrives then stopping terminal...\r\n");
    } else {
      termRef.current?.write("Stopping terminal...\r\n");
    }
    if (sessionId.current) {
      // @ts-ignore
      const sid = sessionId.current;
      sessionId.current = undefined;
      await codeActions.stopTerminal(sid);
    }
    termRef.current?.dispose();
    termRef.current = undefined;
    fitRef.current?.dispose();
    setStarted(false);
  };

  /* -------------------------------------------------- cleanup on unmount */
  useEffect(() => () => {
    if (fitRef.current) (fitRef.current as any).dispose?.();
    termRef.current?.dispose();
    if (sessionId.current) {
      // @ts-ignore
      codeActions.stopTerminal(sessionId.current);
    }
  }, [codeActions]);

  // Poll terminal output every second
  useEffect(() => {
    const id = setInterval(async () => {
      if (!started || !sessionId.current) return;
      try {
        // @ts-ignore helper exists
        const res = await codeActions.getTerminalOutput(sessionId.current);
        if (res?.output && termRef.current) {
          const out = res.output.replaceAll("/project/sandbox", "");
          // Normalize newlines to CRLF so cursor returns to column 0 on xterm
          const toCRLF = (s: string) => s.replace(/\r\n/g, "\n").replace(/\n/g, "\r\n");
          if (pendingEnterRef.current) {
            const parts = out.split(/\r?\n/);
            const adjusted = parts.slice(1).join("\n");
            termRef.current.write(toCRLF(adjusted));
            pendingEnterRef.current = false;
          } else if (pendingTabRef.current) {
            const parts = out.split(/\r?\n/);
            const tabPart = parts.at(0)?.replace(bufferRef.current, "") ?? "";
            termRef.current.write(toCRLF(tabPart));
            preTabBufferRef.current += tabPart;
            bufferRef.current = "";
            pendingTabRef.current = false;
          } else if (pendingBackspaceRef.current) {
            pendingBackspaceRef.current = false;
            return;
          } else {
            termRef.current.write(toCRLF(out));
          }
        }
      } catch {}
    }, 1000);

    return () => clearInterval(id);
  }, [started, codeActions]);

  return (
    <div className="flex flex-col h-full">
      {/* ----- control bar ----- */}
      <div className="flex items-center gap-2 p-2 border-b">
        <BaseDropdown
          context="tile"
          button={
            <ActionButton
              variant="outline"
              text={shell}
              tooltip="Select shell"
              disabled={started}
            />
          }
        >
          {(["bash", "zsh"] as const).map((opt) => (
            <DropdownMenuItem
              key={opt}
              onSelect={() => {
                if (started) return;
                setShell(opt);
                terminalTileActions?.setShellType(opt);
              }}
              className="w-24"
            >
              {opt}
            </DropdownMenuItem>
          ))}
        </BaseDropdown>

        {!started ? (
          <ActionButton
            variant="primary"
            tooltip="Start terminal"
            icon={<Play />}
            onClick={initTerminal}
          />
        ) : (
          <ActionButton
            variant="destructive"
            tooltip="Stop terminal"
            icon={<Square />}
            onClick={stopTerminal}
          />
        )}
        {!isEditMode && !focusPaneOpen && (
          <ActionButton
            icon={<Maximize2 className="h-4 w-4" />}
            variant={focusPaneOpen && (tabUIState?.focusedTileNames || [undefined, undefined]).includes(tiles.find(t=>t.id===tileId)?.name) ? "primary" : "outline"}
            tooltip="Open in focus pane"
            onClick={() => {
              const focusedTileNames = tabUIState?.focusedTileNames || [undefined, undefined];
              const tileName = tiles.find(t=>t.id===tileId)?.name;
              if (tileName && !focusedTileNames.includes(tileName)) {
                tabUIActions?.setFocusedTileNames([
                  tileName,
                  focusedTileNames[0] || focusedTileNames[1],
                ] as [string | undefined, string | undefined]);
              }
              setFocusPaneOpen(true);
            }}
          />
        )}
      </div>

      {/* ----- terminal area ----- */}
      <div className="flex-1 overflow-hidden">
        <div ref={containerRef} className="w-full h-full font-mono" />
      </div>
    </div>
  );
}