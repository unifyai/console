"use client";

var difflib = require("difflib");
import { Span } from "@/types/evals/traces";

export interface PatchDiffNode {
  name: string;
  marker: "+" | "-" | " " | "r"; 
  baseSpanRef?: Span;
  targetSpanRef?: Span;
  children: PatchDiffNode[];
}

/**
 * If you have multiple top-level spans, you can wrap them in a "ROOT"
 * so we have exactly one top node. We'll skip rendering that if it's unchanged.
 */
export function wrapAsRootSpan(spans: Span[], syntheticId: string): Span {
  return {
    id: syntheticId,
    span_name: "ROOT",
    child_spans: spans,
  };
}

/**
 * We'll unify children by name only, ignoring ID, so near‐identical traces
 * won't show as entirely replaced if IDs differ.
 */
function getChildKeyPairsByName(spans: Span[]): {key: string; ref: Span}[] {
  return (spans ?? []).map((child) => ({
    key: child?.span_name || "unknown",
    ref: child,
  }));
}

/**
 * Compare two spans by name. 
 */
export function computeSpanDiffByName(
  baseSpan?: Span,
  targetSpan?: Span
): PatchDiffNode {
  // If both undefined => trivial
  if (!baseSpan && !targetSpan) {
    return { name: "", marker: " ", children: [] };
  }

  if (baseSpan && !targetSpan) {
    return {
      name: baseSpan.span_name,
      marker: "-",
      baseSpanRef: baseSpan,
      children: (baseSpan.child_spans ?? []).map((c) => 
        computeSpanDiffByName(c, undefined)
      ),
    };
  }

  if (!baseSpan && targetSpan) {
    return {
      name: targetSpan.span_name,
      marker: "+",
      targetSpanRef: targetSpan,
      children: (targetSpan.child_spans ?? []).map((c) =>
        computeSpanDiffByName(undefined, c)
      ),
    };
  }

  // If their names differ => treat as replaced
  if (baseSpan && targetSpan && baseSpan.span_name !== targetSpan.span_name) {
    return {
      name: baseSpan.span_name,
      marker: "r",
      baseSpanRef: baseSpan,
      targetSpanRef: targetSpan,
      children: [
        {
          name: baseSpan.span_name,
          marker: "-",
          baseSpanRef: baseSpan,
          children: (baseSpan.child_spans ?? []).map((c) =>
            computeSpanDiffByName(c, undefined)
          ),
        },
        {
          name: targetSpan.span_name,
          marker: "+",
          targetSpanRef: targetSpan,
          children: (targetSpan.child_spans ?? []).map((c) =>
            computeSpanDiffByName(undefined, c)
          ),
        },
      ],
    };
  }

  // If the names match => treat the root node as "unchanged," diff children
  const nodeName = baseSpan?.span_name;
  const baseKids = baseSpan ? getChildKeyPairsByName(baseSpan.child_spans) : [];
  const targetKids = targetSpan ? getChildKeyPairsByName(targetSpan.child_spans) : [];

  const baseKeys = baseKids.map((x) => x.key);
  const targetKeys = targetKids.map((x) => x.key);

  const matcher = new difflib.SequenceMatcher(null, baseKeys, targetKeys);
  const opcodes = matcher.getOpcodes();

  const children: PatchDiffNode[] = [];
  for (const [tag, i1, i2, j1, j2] of opcodes) {
    switch (tag) {
      case "equal": {
        for (let offset = 0; offset < (i2 - i1); offset++) {
          const bRef = baseKids[i1 + offset]?.ref;
          const tRef = targetKids[j1 + offset]?.ref;
          if (!bRef || !tRef) continue;
          children.push(computeSpanDiffByName(bRef, tRef));
        }
        break;
      }
      case "delete": {
        for (let idx = i1; idx < i2; idx++) {
          const bRef = baseKids[idx]?.ref;
          if (!bRef) continue;
          children.push({
            name: bRef.span_name,
            marker: "-",
            baseSpanRef: bRef,
            children: (bRef.child_spans ?? []).map((c) =>
              computeSpanDiffByName(c, undefined)
            ),
          });
        }
        break;
      }
      case "insert": {
        for (let idx = j1; idx < j2; idx++) {
          const tRef = targetKids[idx]?.ref;
          if (!tRef) continue;
          children.push({
            name: tRef.span_name,
            marker: "+",
            targetSpanRef: tRef,
            children: (tRef.child_spans ?? []).map((c) =>
              computeSpanDiffByName(undefined, c)
            ),
          });
        }
        break;
      }
      case "replace": {
        for (let idx = i1; idx < i2; idx++) {
          const bRef = baseKids[idx]?.ref;
          if (!bRef) continue;
          children.push({
            name: bRef.span_name,
            marker: "-",
            baseSpanRef: bRef,
            children: (bRef.child_spans ?? []).map((c) =>
              computeSpanDiffByName(c, undefined)
            ),
          });
        }
        for (let idx = j1; idx < j2; idx++) {
          const tRef = targetKids[idx]?.ref;
          if (!tRef) continue;
          children.push({
            name: tRef.span_name,
            marker: "+",
            targetSpanRef: tRef,
            children: (tRef.child_spans ?? []).map((c) =>
              computeSpanDiffByName(undefined, c)
            ),
          });
        }
        break;
      }
    }
  }

  return {
    name: nodeName ? nodeName : "",
    marker: " ",
    baseSpanRef: baseSpan,
    targetSpanRef: targetSpan,
    children,
  };
}
