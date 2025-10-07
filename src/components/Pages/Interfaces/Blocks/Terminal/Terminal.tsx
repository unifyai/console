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
  const pendingTabRef = useRef<boolean>(false);
  const preTabBufferRef = useRef<string>("");

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
      term.write("Starting terminal...\r\n");
      const { session_id } = await codeActions.createTerminal(shell, projectId);
      term.reset();
      sessionId.current = session_id;
    } catch {
      term.reset();
      term.write("Failed to start terminal session\r\n");
    }

    /* input handling identical as before */
    const history: string[] = [];
    let histIdx = -1;
    const redraw = (prevBuffer: string) => {
      // Erase previous buffer using backspaces, then write the new buffer
      if (prevBuffer && prevBuffer.length > 0) {
        const erase = "\b \b".repeat(prevBuffer.length);
        term.write(erase);
      }
      term.write(bufferRef.current);
    };
    term.onData(async (data: string) => {
      if (!sessionId.current) return;
      switch (data) {
        case "\r":
          const cmd = bufferRef.current.trim().replace(preTabBufferRef.current.trim(), "");
          if (cmd) history.unshift(cmd);
          histIdx = -1;
          // Remove the locally-echoed input so the remote PTY echo replaces it (avoids duplication)
          if (bufferRef.current.length) {
            const erase = "\b \b".repeat(bufferRef.current.length);
            term.write(erase);
          }
          bufferRef.current = "";

          term.write(preTabBufferRef.current);
          preTabBufferRef.current = "";
          await codeActions.runTerminal(sessionId.current, cmd ? cmd + "\n" : "\n");
          // prompt();
          break;
        // case "\u0003":
        //   term.write("^C"); buffer=""; prompt(); break;
        case "\u007F":
          if (bufferRef.current.length) { bufferRef.current=bufferRef.current.slice(0,-1); term.write("\b \b"); }
          break;
        case "\u001b[A":
          if (history.length){
            const prev = bufferRef.current;
            histIdx = Math.min(histIdx + 1, history.length - 1);
            bufferRef.current = history[histIdx] ?? "";
            redraw(prev);
          }
          break;
        case "\u001b[B":
          if (history.length && histIdx >= 0){
            const prev = bufferRef.current;
            histIdx = Math.max(histIdx - 1, -1);
            bufferRef.current = histIdx === -1 ? "" : (history[histIdx] ?? "");
            redraw(prev);
          }
          break;
        case "\t":
          // Send current buffer followed by a tab to trigger shell completion
          // Erase locally typed input to avoid duplicated echo; buffer will be updated from output
          if (bufferRef.current.length) {
            const erase = "\b \b".repeat(bufferRef.current.length);
            term.write(erase);
          }
          preTabBufferRef.current = bufferRef.current;
          pendingTabRef.current = true;
          await codeActions.runTerminal(sessionId.current, bufferRef.current + "\t");
          break;
        default:
          bufferRef.current+=data; term.write(data);
      }
    });
  };

  const stopTerminal = async () => {
    termRef.current?.reset();
    termRef.current?.write("Stopping terminal...\r\n");
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
          termRef.current.write(out);

          if (pendingTabRef.current) {
            bufferRef.current = out;
            preTabBufferRef.current = out;
            pendingTabRef.current = false;
          } else {
            termRef.current.write(bufferRef.current);
          }
        }
      } catch {}
    }, 2000);

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