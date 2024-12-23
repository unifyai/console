import React, { useState } from "react";
import { CodeBlock } from "@/components/UI/Chat/markdown-renderer";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { LogComparisonProps } from "./types";
import { FileText, CaseLower, Pilcrow, Columns, AlignJustify } from "lucide-react";
import ActionButton from "@/components/Common/Buttons/Action";

const StringView: React.FC<LogComparisonProps> = ({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
}) => {
  // Always call Hooks at the top of the component:
  type DiffMode = "lines" | "words" | "characters";
  const modes: DiffMode[] = ["lines", "words", "characters"];
  const modeIcons = [<FileText key="lines" />, <CaseLower key="words" />, <Pilcrow key="chars" />];

  const [modeIndex, setModeIndex] = useState(0);
  const [splitView, setSplitView] = useState(false);
  const diffMode = modes[modeIndex];

  // The rest of your logic
  const baseStr = (value ?? "").toString();

  // If no comparisons, just render single string/Markdown
  if (!comparables || comparables.length === 0) {
    if (baseStr.startsWith("```") && baseStr.endsWith("```")) {
      return (
        <CodeBlock language="python" className="whitespace-pre-wrap ml-4">
          {baseStr.slice(3, -3)}
        </CodeBlock>
      );
    }
    return <pre className="whitespace-pre-wrap ml-4">{baseStr}</pre>;
  }

  // Otherwise, render diffs
  const handleCycleMode = () => setModeIndex((prev) => (prev + 1) % modes.length);
  const handleToggleSplit = () => setSplitView((prev) => !prev);

  return (
    <div className="flex flex-col border-l pl-4 space-y-4">
      {/* Diff toolbar */}
      <div className="flex justify-end gap-2 mb-2">
        <ActionButton
          tooltip={`Cycle diff mode (current: ${diffMode})`}
          icon={modeIcons[modeIndex]}
          onClick={handleCycleMode}
          variant="ghost"
          size="icon"
        />
        <ActionButton
          tooltip={splitView ? "Switch to Inline View" : "Switch to Split View"}
          icon={splitView ? <Columns /> : <AlignJustify />}
          onClick={handleToggleSplit}
          variant="ghost"
          size="icon"
        />
      </div>

      {/* Render diff(s) */}
      {comparables.map((compVal, idx) => {
        const newStr = (compVal ?? "").toString();
        const compIndex = comparisonLogsIndex ? comparisonLogsIndex[idx] : "?";

        return (
          <div key={idx} className="mb-4">
            <p className="text-xs text-muted-foreground mb-1">
              Diff: Row {baseLogIndex} vs. Row {compIndex}
            </p>
            <DiffViewer
              oldValue={baseStr}
              newValue={newStr}
              hideLineNumbers
              hideMarkers
              splitView={splitView}
              showDiffOnly={false}
              mode={diffMode}
            />
          </div>
        );
      })}
    </div>
  );
};

export default StringView;