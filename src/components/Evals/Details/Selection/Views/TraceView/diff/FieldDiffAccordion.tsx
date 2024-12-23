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
}

const FieldDiffAccordion: React.FC<Props> = ({
  uniqueKey,
  title,
  baseVal,
  comparables,
  rowIndexes,
  getValue,
  diffMode,
  splitView,
}) => {
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