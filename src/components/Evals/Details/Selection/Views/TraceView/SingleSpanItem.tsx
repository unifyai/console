"use client";
import React from "react";
import { Span } from "@/types/evals/traces";
import {
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import { ChevronsLeftRightEllipsis } from "lucide-react";

interface SingleSpanItemProps {
  span: Span;
  depth: number; // used for indentation
}

/**
 * SingleSpanItem renders one <AccordionItem> with optional
 * border/indent styling to show nesting. It does NOT create
 * another <Accordion>—we stay in the top-level Accordion context.
 */
const SingleSpanItem: React.FC<SingleSpanItemProps> = ({ span, depth }) => {
  const { span_name, id, offset, exec_time, inputs, outputs, errors, child_spans } = span;

  return (
    <AccordionItem value={id}>
      {/* Title row: Chevrons icon, name, etc. */}
      <AccordionTrigger>
        <div
          className="flex items-center gap-3"
          style={{ marginLeft: depth * 16 }}
        >
          <ChevronsLeftRightEllipsis className="h-4 w-4 text-primary" />
          <span className="font-semibold">{span_name}</span>
        </div>
      </AccordionTrigger>

      {/* Content container with a left border for nesting */}
      <AccordionContent>
        <div
          className="relative mt-2 space-y-2 border-l pl-4"
          style={{ marginLeft: depth * 16 }}
        >
          {/* Basic info */}
          <p className="text-xs italic text-muted-foreground">
            ID: {id}, offset: {offset ?? 0}, duration: {exec_time ?? 0}
          </p>
          {errors && (
            <p className="text-destructive font-semibold">Error: {errors}</p>
          )}

          {/* Inputs */}
          {inputs && (
            <div className="my-2 border p-2 rounded bg-background">
              <strong className="block underline mb-1 text-sm">Inputs:</strong>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(inputs, null, 2)}
              </pre>
            </div>
          )}
          {/* Outputs */}
          {outputs && (
            <div className="my-2 border p-2 rounded bg-background">
              <strong className="block underline mb-1 text-sm">Outputs:</strong>
              <pre className="whitespace-pre-wrap text-sm">
                {JSON.stringify(outputs, null, 2)}
              </pre>
            </div>
          )}

          {/* Recursively render child_spans (still in the same Accordion context). */}
          {child_spans?.map((child) => (
            <SingleSpanItem key={child.id} span={child} depth={depth + 1} />
          ))}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default SingleSpanItem;