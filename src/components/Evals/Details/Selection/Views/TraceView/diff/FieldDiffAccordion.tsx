"use client";
import React from "react";
import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/UI/accordion";
import { Span } from "@/types/evals/traces";
import FieldDiff from "./FieldDiff";

interface Props {
  uniqueKey: string;
  title: string;
  baseVal: Span | undefined;
  comparables: Array<Span | undefined>;
  rowIndexes: number[];
  getValue: (s: Span | undefined) => string;
  diffMode: "lines" | "words" | "characters";
  splitView: boolean;
  // ────────── NEW ──────────
  hideIdentical?: boolean;
}

/** If everything is the same across baseVal & comparables, return true. */
function allIdentical(
  baseVal: Span | undefined,
  comparables: Array<Span | undefined>,
  getValue: (s: Span | undefined) => string
): boolean {
  const baseText = getValue(baseVal);
  return comparables.every((c) => getValue(c) === baseText);
}

/**
 * FieldDiffAccordion:
 * Another <AccordionItem> in the same parent Accordion.
 */
const FieldDiffAccordion: React.FC<Props> = ({
  uniqueKey,
  title,
  baseVal,
  comparables,
  rowIndexes,
  getValue,
  diffMode,
  splitView,
  hideIdentical = false,
}) => {
  // Skip rendering if “hideIdentical” is on AND absolutely everything is the same:
  if (
    hideIdentical &&
    allIdentical(baseVal, comparables, getValue)
  ) {
    return null; // entire sub‐field is identical, so skip
  }

  return (
    <AccordionItem value={uniqueKey}>
      <AccordionTrigger>
        <span className="font-medium">{title}</span>
      </AccordionTrigger>
      <AccordionContent>
        <FieldDiff
          baseVal={baseVal}
          comparables={comparables}
          rowIndexes={rowIndexes}
          getValue={getValue}
          diffMode={diffMode}
          splitView={splitView}
        />
      </AccordionContent>
    </AccordionItem>
  );
};

export default FieldDiffAccordion;
