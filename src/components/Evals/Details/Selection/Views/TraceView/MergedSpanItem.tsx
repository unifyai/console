import React, { useEffect, useState } from "react";
import { ChevronsLeftRightEllipsis } from "lucide-react";
import { AccordionItem, AccordionTrigger, AccordionContent, Accordion } from "@/components/UI/accordion";
import { Span } from "@/types/evals/traces";
import { useExpandAllContext } from "./ExpandAllContext";
import FieldDiffAccordion from "./diff/FieldDiffAccordion";

interface MergedSpan {
  spanName: string;
  baseSpan?: Span;
  comparableSpans: Array<Span | undefined>;
  children: MergedSpan[];
}

const MergedSpanItem: React.FC<{
  merged: MergedSpan;
  rowIndexes: number[];
  diffMode: "lines" | "words" | "characters";
  splitView: boolean;
}> = ({ merged, rowIndexes, diffMode, splitView }) => {
  const { spanName, baseSpan, comparableSpans, children } = merged;
  const baseErrors = baseSpan?.errors || "";
  const hasComparisonErrors = comparableSpans.some((c) => c?.errors);
  const showErrors = baseErrors || hasComparisonErrors;

  // local sub-accordion state
  const [openItems, setOpenItems] = useState<string[]>([]);

  // React to "expand/collapse all" context
  const { expandAll, toggleCounter } = useExpandAllContext();
  useEffect(() => {
    if (expandAll) {
      const itemsToOpen: string[] = [
        `offset-${spanName}`,
        `execTime-${spanName}`,
      ];
      if (showErrors) {
        itemsToOpen.push(`errors-${spanName}`);
      }
      itemsToOpen.push(`inputs-${spanName}`);
      itemsToOpen.push(`outputs-${spanName}`);
      setOpenItems(itemsToOpen);
    } else {
      setOpenItems([]);
    }
  }, [expandAll, toggleCounter, showErrors, spanName]);

  return (
    <AccordionItem value={`${spanName}-${baseSpan?.id || Math.random()}`}>
      <AccordionTrigger>
        <div className="flex items-center gap-3 w-full">
          <ChevronsLeftRightEllipsis className="h-4 w-4 text-primary" />
          <span className="font-semibold">{spanName}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="flex flex-col">
        {baseSpan?.id && (
          <span className="ml-2 text-xs italic text-muted-foreground">
            Row {rowIndexes[0] + 1} (Base): {baseSpan.id}
          </span>
        )}
        {comparableSpans.map((c, index) => (
          <span key={c?.id} className="ml-2 text-xs italic text-muted-foreground">
            Row {rowIndexes[index + 1] + 1}: {c?.id ?? "N/A"}
          </span>
        ))}
        </div>

        <Accordion
          type="multiple"
          className="border-l pl-3 my-2 space-y-1"
          value={openItems}
          onValueChange={setOpenItems}
        >
          <FieldDiffAccordion
            uniqueKey={`offset-${spanName}`}
            title="Offset"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => (s?.offset ?? 0).toString()}
            diffMode={diffMode}
            splitView={splitView}
          />
          <FieldDiffAccordion
            uniqueKey={`execTime-${spanName}`}
            title="Exec Time"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => (s?.exec_time ?? 0).toString()}
            diffMode={diffMode}
            splitView={splitView}
          />

          {showErrors && (
            <FieldDiffAccordion
              uniqueKey={`errors-${spanName}`}
              title="Errors"
              baseVal={baseSpan}
              comparables={comparableSpans}
              rowIndexes={rowIndexes}
              getValue={(s) => s?.errors ?? ""}
              diffMode={diffMode}
              splitView={splitView}
            />
          )}
          <FieldDiffAccordion
            uniqueKey={`inputs-${spanName}`}
            title="Inputs"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => JSON.stringify(s?.inputs ?? {}, null, 2)}
            diffMode={diffMode}
            splitView={splitView}
          />
          <FieldDiffAccordion
            uniqueKey={`outputs-${spanName}`}
            title="Outputs"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => JSON.stringify(s?.outputs ?? {}, null, 2)}
            diffMode={diffMode}
            splitView={splitView}
          />
        </Accordion>

        {/* Child merges */}
        {children.length > 0 && (
          <div className="ml-4 mt-4 border-l pl-4">
            <Accordion type="multiple">
              {children.map((child, i) => (
                <MergedSpanItem
                  key={i}
                  merged={child}
                  rowIndexes={rowIndexes}
                  diffMode={diffMode}
                  splitView={splitView}
                />
              ))}
            </Accordion>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default MergedSpanItem;