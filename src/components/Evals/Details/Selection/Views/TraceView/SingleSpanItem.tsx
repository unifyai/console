import React from "react";
import { Span } from "@/types/evals/traces";
import { AccordionItem, AccordionTrigger, AccordionContent, Accordion } from "@/components/UI/accordion";
import { ChevronsLeftRightEllipsis } from "lucide-react";


/**
 * SingleSpanItem:
 * Renders one span inside an AccordionItem, including its child_spans (recursively).
 */
const SingleSpanItem: React.FC<{ span: Span }> = ({ span }) => {
  const childSpans = span.child_spans ?? [];

  return (
    <AccordionItem value={span.id}>
      <AccordionTrigger>
        <div className="flex items-center gap-3 w-full">
          <ChevronsLeftRightEllipsis className="h-4 w-4 text-primary" />
          <span className="font-semibold">{span.span_name}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <p className="text-xs italic text-muted-foreground">
          ID: <span>{span.id}</span>
        </p>
        <p className="text-xs italic text-muted-foreground">
          Offset: {span.offset ?? 0}, duration: {span.exec_time ?? 0}
        </p>
        {span.errors && (
          <p className="text-destructive font-semibold mb-2">Error: {span.errors}</p>
        )}
        {span.inputs && (
          <div className="my-2 border p-2 rounded bg-background">
            <strong className="block underline mb-1 text-sm">Inputs:</strong>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(span.inputs, null, 2)}
            </pre>
          </div>
        )}
        {span.outputs && (
          <div className="my-2 border p-2 rounded bg-background">
            <strong className="block underline mb-1 text-sm">Outputs:</strong>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(span.outputs, null, 2)}
            </pre>
          </div>
        )}

        {childSpans.length > 0 && (
          <div className="ml-4 mt-4 border-l pl-4 space-y-2">
            <Accordion type="multiple">
              {childSpans.map((child) => (
                <SingleSpanItem key={child.id} span={child} />
              ))}
            </Accordion>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
};

export default SingleSpanItem;

