"use client";
import React from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/UI/accordion";
import { ChevronsLeftRightEllipsis } from "lucide-react";
import type { Span } from "@/types/evals/traces";
import FieldDiffAccordion from "./diff/FieldDiffAccordion";

/**
 * A merged span has:
 *  - a canonical “baseSpan”
 *  - an array of comparableSpans
 *  - child merges
 */
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
  depth: number;  // For visual indentation
}

/**
 * MergedSpanItem:
 * - Returns a single <AccordionItem> for the mergedSpan itself.
 * - Sub-fields are also <AccordionItem> items (FieldDiffAccordion) sharing the same top-level context.
 * - Children are rendered recursively, also as <AccordionItem> sets, so everything belongs
 *   to that single, top-level Accordion in MultiTraceView.
 */
const MergedSpanItem: React.FC<MergedSpanItemProps> = ({
  merged,
  rowIndexes,
  diffMode,
  splitView,
  depth
}) => {
  const { spanName, baseSpan, comparableSpans, children } = merged;
  const hasErrors = baseSpan?.errors || comparableSpans.some(c => c?.errors);

  // This is the ID for the main item (e.g. "spanName-baseSpanId")
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
          />

          {/* Recursively render children in the same top-level Accordion context */}
          {children.map((child, i) => (
            <MergedSpanItem
              key={i}
              merged={child}
              rowIndexes={rowIndexes}
              diffMode={diffMode}
              splitView={splitView}
              depth={depth + 1}
            />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default MergedSpanItem;
