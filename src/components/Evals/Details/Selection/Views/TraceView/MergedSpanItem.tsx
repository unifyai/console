"use client";
import React from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/UI/accordion";
import { ChevronsLeftRightEllipsis } from "lucide-react";
import type { Span } from "@/types/evals/traces";
import FieldDiffAccordion from "./diff/FieldDiffAccordion";

export interface MergedSpan {
  spanName: string;
  baseSpan?: Span;
  comparableSpans: Array<Span | undefined>;
  children: MergedSpan[];
}

interface MergedSpanItemProps {
  merged: MergedSpan;
  rowIndexes: number[];
  diffMode: "lines" | "words" | "characters";
  splitView: boolean;
  depth: number;  
  // ────────── NEW ──────────
  hideIdentical?: boolean;
}

const MergedSpanItem: React.FC<MergedSpanItemProps> = ({
  merged,
  rowIndexes,
  diffMode,
  splitView,
  depth,
  hideIdentical = false,
}) => {
  const { spanName, baseSpan, comparableSpans, children } = merged;
  const hasErrors = baseSpan?.errors || comparableSpans.some(c => c?.errors);

  const itemId = `${spanName}-${baseSpan?.id ?? "no-base"}`;

  return (
    <AccordionItem value={itemId}>
      {/* Primary trigger for this entire merged span */}
      <AccordionTrigger>
        <div
          className="flex items-center gap-3"
          style={{ marginLeft: depth * 16 }}
        >
          <ChevronsLeftRightEllipsis className="h-4 w-4 text-primary" />
          <span className="font-semibold">{spanName}</span>
        </div>
      </AccordionTrigger>

      <AccordionContent>
        {/* Nested visual indent + border */}
        <div
          className="border-l pl-4 space-y-2"
          style={{ marginLeft: depth * 16 }}
        >
          {/* Basic row references */}
          {baseSpan?.id && (
            <p className="ml-2 text-xs italic text-muted-foreground">
              Row {rowIndexes[0]} (Base): {baseSpan.id}
            </p>
          )}
          {comparableSpans.map((c, index) => (
            <p
              key={index}
              className="ml-2 text-xs italic text-muted-foreground"
            >
              Row {rowIndexes[index + 1]}: {c?.id ?? "N/A"}
            </p>
          ))}

          {/* Sub-fields: offset, execTime, errors (optional), inputs, outputs */}
          <FieldDiffAccordion
            uniqueKey={`offset-${itemId}`}
            title="Offset"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => String(s?.offset ?? 0)}
            diffMode={diffMode}
            splitView={splitView}
            hideIdentical={hideIdentical}  // <--- pass
          />

          <FieldDiffAccordion
            uniqueKey={`execTime-${itemId}`}
            title="Exec Time"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => String(s?.exec_time ?? 0)}
            diffMode={diffMode}
            splitView={splitView}
            hideIdentical={hideIdentical}
          />

          {hasErrors && (
            <FieldDiffAccordion
              uniqueKey={`errors-${itemId}`}
              title="Errors"
              baseVal={baseSpan}
              comparables={comparableSpans}
              rowIndexes={rowIndexes}
              getValue={(s) => s?.errors ?? ""}
              diffMode={diffMode}
              splitView={splitView}
              hideIdentical={hideIdentical}
            />
          )}

          <FieldDiffAccordion
            uniqueKey={`inputs-${itemId}`}
            title="Inputs"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => JSON.stringify(s?.inputs ?? {}, null, 2)}
            diffMode={diffMode}
            splitView={splitView}
            hideIdentical={hideIdentical}
          />

          <FieldDiffAccordion
            uniqueKey={`outputs-${itemId}`}
            title="Outputs"
            baseVal={baseSpan}
            comparables={comparableSpans}
            rowIndexes={rowIndexes}
            getValue={(s) => JSON.stringify(s?.outputs ?? {}, null, 2)}
            diffMode={diffMode}
            splitView={splitView}
            hideIdentical={hideIdentical}
          />

          {/* Recursively render children in the same top-level Accordion */}
          {children.map((child, i) => (
            <MergedSpanItem
              key={i}
              merged={child}
              rowIndexes={rowIndexes}
              diffMode={diffMode}
              splitView={splitView}
              depth={depth + 1}
              hideIdentical={hideIdentical} // pass along
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default MergedSpanItem;
