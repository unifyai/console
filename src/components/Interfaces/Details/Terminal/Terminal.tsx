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
} from "@/types/evals/grid";
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
import { Play, Square } from "lucide-react";

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


  /* -------------------------------------------------- state / refs */
  const [started, setStarted] = useState(false);
  const [shell, setShell] = useState(terminalTileState?.shell_type || "bash");
  const containerRef = useRef<HTMLDivElement>(null);
  const bufferRef = useRef<string>("");
  const termRef = useRef<XTerm>();
  const fitRef = useRef<FitAddon>();
  const sessionId = useRef<string>();

  /* -------------------------------------------------- helpers */
  const prompt = () => termRef.current?.write("\r\n$ ");

  /* -------------------------------------------------- helper to init terminal */
  const initTerminal = async () => {
    if (started) return;

    /* xterm setup */
    const term = new XTerm({ fontFamily: "monospace", theme: { background: "#1e1e1e" }, cursorBlink: true });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current!);
    fit.fit();
    term.focus();
    termRef.current = term;
    fitRef.current = fit;
    setStarted(true);

    const resizeObserver = new ResizeObserver(() => fit.fit());
    resizeObserver.observe(containerRef.current!);

    try {
      // @ts-ignore global actions
      term.write("Starting shell...\n");
      const { session_id } = await codeActions.createTerminal(shell);
      sessionId.current = session_id;
      term.reset();
      term.write("Shell started!\n");
      const res = await codeActions.runTerminal(sessionId.current, "\n");
    } catch {
      term.reset();
      term.write("Failed to start terminal session\r\n");
    }

    /* input handling identical as before */
    const history: string[] = [];
    let histIdx = -1;
    const redraw = () => {
      term.write("\x1b[2K\r$ ");
      term.write(bufferRef.current);
    };
    term.onData(async (data: string) => {
      if (!sessionId.current) return;
      switch (data) {
        case "\r":
          term.write("\r\n");
          const cmd = bufferRef.current.trim();
          if (cmd) history.unshift(cmd);
          histIdx = -1;
          bufferRef.current = "";
          if (cmd) {
            // @ts-ignore
            const res = await codeActions.runTerminal(sessionId.current, cmd + "\n");
          }
          // prompt();
          break;
        // case "\u0003":
        //   term.write("^C"); buffer=""; prompt(); break;
        case "\u007F":
          if (bufferRef.current.length) { bufferRef.current=bufferRef.current.slice(0,-1); term.write("\b \b"); }
          break;
        // case "\u001b[A":
        //   if (history.length){ histIdx=Math.min(histIdx+1,history.length-1); buffer=history[histIdx]??""; redraw(); }
        //   break;
        // case "\u001b[B":
        //   if (history.length&&histIdx>=0){ histIdx=Math.max(histIdx-1,-1); buffer=histIdx===-1?"":history[histIdx]??""; redraw(); }
        //   break;
        default:
          bufferRef.current+=data; term.write(data);
      }
    });
  };

  const stopTerminal = async () => {
    if (sessionId.current) {
      // @ts-ignore
      await codeActions.stopTerminal(sessionId.current);
      sessionId.current = undefined;
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
  }, []);

  // Poll terminal output every second
  useEffect(() => {
    const id = setInterval(async () => {
      if (!started || !sessionId.current) return;
      try {
        // @ts-ignore helper exists
        const res = await codeActions.getTerminalOutput(sessionId.current);
        if (res?.output && termRef.current) {
          termRef.current.reset();
          termRef.current.write(res.output);
          termRef.current.write(bufferRef.current);
        }
      } catch {}
    }, 1000);

    return () => clearInterval(id);
  }, [started]);

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
              className="w-24 capitalize"
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
      </div>

      {/* ----- terminal area ----- */}
      <div className="flex-1 overflow-hidden">
        <div ref={containerRef} className="w-full h-full" />
      </div>
    </div>
  );
}