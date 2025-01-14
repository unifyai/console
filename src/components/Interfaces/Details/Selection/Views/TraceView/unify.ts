import { Span } from "@/types/evals/traces";

export const colorPalette = ["#9333ea", "#3b82f6", "#22c55e", "#f43f5e", "#eab308"];

/** 
 * unifyByName => merges multiple arrays by “span_name”, for multi-diff.
 * Produces an array of MergedSpan objects (spanName, baseSpan, comparableSpans, children).
 */
export function unifyByName(traces: Span[][]): any[] {
  // Each “trace array” => mapNameToSpan[] 
  const mapList = traces.map((arr) => {
    const m = new Map<string, Span[]>();
    arr.forEach((s) => {
      const bucket = m.get(s.span_name) || [];
      bucket.push(s);
      m.set(s.span_name, bucket);
    });
    return m;
  });

  // Union of all span_names
  const allNames = new Set<string>();
  mapList.forEach((m) => {
    m.forEach((_, name) => allNames.add(name));
  });

  const merged = [];
  for (const name of Array.from(allNames)) {
    const baseArray = mapList[0].get(name) || [];
    const comparableArrays = mapList.slice(1).map((m) => m.get(name) || []);
    const maxLen = Math.max(baseArray.length, ...comparableArrays.map((c) => c.length));

    for (let i = 0; i < maxLen; i++) {
      const baseSpan = baseArray[i];
      const comps = comparableArrays.map((c) => c[i]);
      const childArrays = [baseSpan, ...comps].map((s) => s?.child_spans ?? []);
      merged.push({
        spanName: name,
        baseSpan,
        comparableSpans: comps,
        children: unifyByName(childArrays),
      });
    }
  }
  return merged;
}

/** 
 * unifyTracesForChart => merges multiple traces for Gantt (BarChart).
 */
export function unifyTracesForChart(allTraces: Span[][]) {
  const mapList = allTraces.map((arr) => groupFlattenedCalls(arr));
  const allLabels = new Set<string>();
  mapList.forEach((m) => {
    for (const label of Array.from(m.keys())) {
      allLabels.add(label);
    }
  });

  const chartRows: any[] = [];
  for (const label of Array.from(allLabels)) {
    const baseArray = mapList[0].get(label) || [];
    const otherArrays = mapList.slice(1).map((m) => m.get(label) || []);
    const maxLen = Math.max(baseArray.length, ...otherArrays.map((a) => a.length));

    for (let i = 0; i < maxLen; i++) {
      const row: any = { label: maxLen > 1 ? `${label} (#${i + 1})` : label };
      mapList.forEach((mapForTrace, traceIndex) => {
        const arr = mapForTrace.get(label) || [];
        const call = arr[i];
        if (call) {
          const start = call.start;
          const length = call.end - call.start;
          row[`start-${traceIndex}`] = start;
          row[`length-${traceIndex}`] = length;
        } else {
          row[`start-${traceIndex}`] = 0;
          row[`length-${traceIndex}`] = 0;
        }
      });
      chartRows.push(row);
    }
  }
  return chartRows;
}

interface FlattenedCall {
  id: string;
  label: string;
  start: number;
  end: number;
}

/** groupFlattenedCalls => flatten each span, grouping them by label. */
function groupFlattenedCalls(spans: Span[]): Map<string, FlattenedCall[]> {
  const flattenedSpans = flattenSpans(spans);
  const map = new Map<string, FlattenedCall[]>();
  flattenedSpans.forEach((fc) => {
    const arr = map.get(fc.label) || [];
    arr.push(fc);
    map.set(fc.label, arr);
  });
  return map;
}

/** flattenSpans => collect (label=span_name, start=offset, end=offset+exec_time). */
function flattenSpans(spans: Span[]): FlattenedCall[] {
  const results: FlattenedCall[] = [];
  function traverse(span: Span) {
    const start = span.offset ?? 0;
    const end = start + (span.exec_time ?? 0);
    results.push({
      id: span.id,
      label: span.span_name,
      start,
      end,
    });
    span.child_spans?.forEach(traverse);
  }
  spans.forEach(traverse);
  return results;
}
