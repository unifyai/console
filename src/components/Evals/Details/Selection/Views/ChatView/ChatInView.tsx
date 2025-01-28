"use client";

import React from "react";
import { LogComparisonProps } from "../types";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/UI/accordion";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/UI/tabs";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import RowBadge from "../RowBadge";
import MarkdownRenderer from "../MarkdownRenderer";
import DiffViewer from "@/components/Common/Misc/DiffViewer";

import DictionaryView from "../DictionaryView";
import ListView from "../ListView";
import ImageView from "../ImageView";
import MatrixView from "../MatrixView";
import StringView from "../StringView";
import NumberView from "../NumberView";
import TimestampView from "../TimestampView";

import {
  isDict,
  isList,
  isImage,
  isMatrix,
  isNumber,
  isTimestamp,
} from "@/utils/evals/selection";

/******************************************************************************
 * pickDataView(value, valueComparables, baseIndex, compIndexes, diffMode, splitView)
 *   => returns the correct *View with multi-diff if needed
 ******************************************************************************/
function pickDataView(
  baseValue: any,
  comparables: any[],
  baseLogIndex: number,
  compLogIndexes: number[],
  diffMode: LogComparisonProps["diffMode"],
  splitView: boolean
) {
  // Decide which specialized view to use. We pass comparables if we want multi-diffs.
  // If baseValue is a dictionary, we do DictionaryView, etc.
  // Additional logic can expand as needed.

  // Quick function to skip “comparables” if we definitely want single:
  function singleView(v: any) {
    return pickDataView(v, [], baseLogIndex, compLogIndexes, diffMode, splitView);
  }

  // Decide type from baseValue or from the first available comparable (if base is undefined).
  let finalValue = baseValue;
  if (finalValue === undefined && comparables && comparables.length > 0) {
    finalValue = comparables.find((c) => c !== undefined);
  }

  if (isDict(finalValue)) {
    return (
      <DictionaryView
        value={baseValue}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isList(finalValue)) {
    return (
      <ListView
        value={baseValue}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isImage(finalValue)) {
    return (
      <ImageView
        value={baseValue}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isMatrix(finalValue)) {
    return (
      <MatrixView
        value={baseValue}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isNumber(finalValue)) {
    return (
      <NumberView
        value={baseValue}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isTimestamp(finalValue)) {
    return (
      <TimestampView
        value={baseValue}
        comparables={comparables}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={compLogIndexes}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }

  // fallback => string
  return (
    <StringView
      value={baseValue}
      comparables={comparables}
      baseLogIndex={baseLogIndex}
      comparisonLogsIndex={compLogIndexes}
      diffMode={diffMode}
      splitView={splitView}
    />
  );
}

/******************************************************************************
 * renderMessageContent => handles text arrays, images, etc.
 ******************************************************************************/
function renderMessageContent(content: unknown): JSX.Element {
  if (typeof content === "string") {
    return <MarkdownRenderer>{content}</MarkdownRenderer>;
  }
  if (Array.isArray(content)) {
    return (
      <>
        {content.map((chunk, i) => {
          if (typeof chunk === "string") {
            return <MarkdownRenderer key={i}>{chunk}</MarkdownRenderer>;
          }
          if (chunk && typeof chunk === "object") {
            if (chunk.type === "text" && typeof chunk.text === "string") {
              return <MarkdownRenderer key={i}>{chunk.text}</MarkdownRenderer>;
            } else if (
              chunk.type === "image_url" &&
              chunk.image_url?.url
            ) {
              return <img key={i} src={chunk.image_url.url} alt={`Image ${i}`} />;
            }
            // default => JSON
            return (
              <pre key={i} className="bg-background p-2 text-xs rounded">
                {JSON.stringify(chunk, null, 2)}
              </pre>
            );
          }
          // fallback => JSON
          return (
            <pre key={i} className="bg-background p-2 text-xs rounded">
              {JSON.stringify(chunk, null, 2)}
            </pre>
          );
        })}
      </>
    );
  }
  // fallback => JSON
  return (
    <pre className="bg-background p-2 text-xs rounded">
      {JSON.stringify(content, null, 2)}
    </pre>
  );
}

/******************************************************************************
 * unifyMessages => merges base + comparable messages by index
 ******************************************************************************/
function unifyMessages(baseArr: any[], compArrs: any[][]) {
  const maxLen = Math.max(baseArr.length, ...compArrs.map((arr) => arr.length));
  const out: {
    index: number;
    baseMsg?: any;
    compMsgs: (any | null)[];
  }[] = [];
  for (let i = 0; i < maxLen; i++) {
    out.push({
      index: i,
      baseMsg: baseArr[i],
      compMsgs: compArrs.map((c) => c[i] ?? null),
    });
  }
  return out;
}

export default function ChatInView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
}: LogComparisonProps) {
  //
  // 1) SINGLE MODE => just a vertical list
  //
  const singleMode = !comparables || comparables.length === 0;
  if (singleMode) {
    const chatObj = (value && typeof value === "object") ? value : {};
    const messages = Array.isArray(chatObj.messages) ? chatObj.messages : [];
    const usage = chatObj.usage;
    const leftover: Record<string, any> = { ...chatObj };
    delete leftover.messages;
    delete leftover.usage;
    // We'll do a model diff using stringview in single mode anyway:
    const model = leftover.model ?? "";
    delete leftover.model;

    return (
      <div className="space-y-4 w-full">
        {/* Chat messages */}
        {messages.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold border-b pb-2">Chat</p>
            <div className="flex flex-col gap-2">
              {messages.map((m: any, idx: number) => {
                const role = m.role ?? "assistant";
                const label = role === "user" ? "User" : "Assistant";

                return (
                  <div
                    key={idx}
                    className="hover:border hover:border-muted bg-background p-4 rounded shadow-sm w-full"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold text-sm">{label}</p>
                      <CopyButton
                        content={JSON.stringify(m.content ?? "")}
                        copyMessage="Copied!"
                      />
                    </div>
                    {renderMessageContent(m.content)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Model + leftover usage + metadata */}
        <Accordion type="multiple" className="space-y-2">
          {model && (
            <AccordionItem value="model">
              <AccordionTrigger>Model</AccordionTrigger>
              <AccordionContent>
                <StringView
                  value={model}
                  comparables={[]}
                  baseLogIndex={baseLogIndex}
                  comparisonLogsIndex={[]}
                  diffMode={diffMode}
                  splitView={splitView}
                />
              </AccordionContent>
            </AccordionItem>
          )}

          {usage !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger>Usage</AccordionTrigger>
              <AccordionContent>
                {pickDataView(usage, [], baseLogIndex, [], diffMode, splitView)}
              </AccordionContent>
            </AccordionItem>
          )}

          {Object.keys(leftover).length > 0 && (
            <AccordionItem value="metadata">
              <AccordionTrigger>Metadata</AccordionTrigger>
              <AccordionContent>
                {pickDataView(leftover, [], baseLogIndex, [], diffMode, splitView)}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    );
  }

  //
  // 2) MULTI-MODE => unify messages + do multi-object diffs
  //
  const baseObj = (value && typeof value === "object") ? value : {};
  const compObjs = (comparables ?? []).map((co) =>
    co && typeof co === "object" ? co : {}
  );

  // (a) unify main messages
  const baseArr = Array.isArray(baseObj.messages) ? baseObj.messages : [];
  const compArrs = compObjs.map((co) =>
    Array.isArray(co.messages) ? co.messages : []
  );

  // (b) gather usage + leftover from each object => do multi-diffs
  const baseUsage = baseObj.usage;
  const usageComparables = compObjs.map((co) => co.usage);
  let leftover: Record<string, any> = { ...baseObj };
  delete leftover.messages;
  delete leftover.usage;
  const baseModel = leftover.model ?? "";
  delete leftover.model;

  const leftoverComparables = compObjs.map((co) => {
    const cObj = { ...co };
    delete cObj.messages;
    delete cObj.usage;
    const cModel = cObj.model; // we handle model separately
    delete cObj.model;
    return cObj;
  });

  // For model, we do a string diff
  const compModels = compObjs.map((co) => co.model ?? "");

  // unify them
  const unified = unifyMessages(baseArr, compArrs);

  /**
   * gatherAll => collects the base (if present) plus each comparable message or (if missing) an empty string,
   * ensuring the role for missing comps matches the base message's role if possible.
   */
  function gatherAll(idxData: { baseMsg?: any; compMsgs: (any | null)[] }) {
    const out: {
      isBase: boolean;
      role: string;
      rowIndex: number;
      content: any;
    }[] = [];

    // The “base” message if it exists
    const base = idxData.baseMsg;
    if (base) {
      const bRole = base.role ?? "assistant";
      out.push({
        isBase: true,
        role: bRole,
        rowIndex: baseLogIndex,
        content: base.content,
      });
    }

    // Each comparable message
    idxData.compMsgs.forEach((cm, i) => {
      if (!cm) {
        // If missing, create an empty message with the base’s role if possible
        const fallbackRole = base ? base.role ?? "assistant" : "assistant";
        out.push({
          isBase: false,
          role: fallbackRole,
          rowIndex: comparisonLogsIndex[i],
          content: "",
        });
      } else {
        const role = cm.role ?? "assistant";
        out.push({
          isBase: false,
          role,
          rowIndex: comparisonLogsIndex[i],
          content: cm.content,
        });
      }
    });
    return out;
  }

  // (c) If diffMode === "none", use tab approach for messages
  if (diffMode === "none") {
    return (
      <div className="space-y-4 w-full">
        <p className="font-semibold border-b pb-2">Chat Comparison</p>

        <div className="space-y-6 w-full">
          {unified.map((block, i) => {
            const msgs = gatherAll(block);
            if (!msgs.length) return null;

            const userParts = msgs.filter((m) => m.role === "user");
            const asstParts = msgs.filter((m) => m.role !== "user");

            return (
              <div key={i} className="flex flex-col gap-6 w-full">
                {/* Assistant side => align left */}
                {asstParts.length > 0 && (
                  <div className="flex flex-col w-full">
                    <Tabs defaultValue={String(asstParts[0].rowIndex)}>
                      <div className="flex items-center justify-start text-sm mb-2 w-full">
                        <TabsList className="justify-start">
                          {asstParts.map((m) => (
                            <TabsTrigger
                              key={m.rowIndex}
                              value={String(m.rowIndex)}
                            >
                              Row {m.rowIndex}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>

                      {asstParts.map((m) => {
                        const label = m.role === "user" ? "User" : "Assistant";
                        return (
                          <TabsContent
                            key={m.rowIndex}
                            value={String(m.rowIndex)}
                            className="w-full"
                          >
                            <div className="hover:border hover:border-muted bg-background p-4 rounded shadow-sm w-full">
                              <div className="mb-2 flex items-center justify-between">
                                <p className="font-bold text-sm">{label}</p>
                                <CopyButton
                                  content={JSON.stringify(m.content ?? "")}
                                  copyMessage="Copied!"
                                />
                              </div>
                              {renderMessageContent(m.content)}
                            </div>
                          </TabsContent>
                        );
                      })}
                    </Tabs>
                  </div>
                )}

                {/* User side => align right */}
                {userParts.length > 0 && (
                  <div className="flex flex-col w-full">
                    <Tabs defaultValue={String(userParts[0].rowIndex)}>
                      <div className="flex items-center justify-between text-sm mb-2 w-full">
                        <TabsList className="justify-end">
                          {userParts.map((m) => (
                            <TabsTrigger
                              key={m.rowIndex}
                              value={String(m.rowIndex)}
                            >
                              Row {m.rowIndex}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>
                      {userParts.map((m) => (
                        <TabsContent
                          key={m.rowIndex}
                          value={String(m.rowIndex)}
                          className="w-full"
                        >
                          <div className="hover:border hover:border-muted bg-background p-4 rounded shadow-sm w-full">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-bold text-sm">User</p>
                              <CopyButton
                                content={JSON.stringify(m.content ?? "")}
                                copyMessage="Copied!"
                              />
                            </div>
                            {renderMessageContent(m.content)}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional data => Model, usage, leftover (multi) */}
        <Accordion type="multiple" className="space-y-2">
          {/* Model diffs */}
          <AccordionItem value="model">
            <AccordionTrigger>Model</AccordionTrigger>
            <AccordionContent>
              <StringView
                value={baseModel}
                comparables={compModels}
                baseLogIndex={baseLogIndex}
                comparisonLogsIndex={comparisonLogsIndex}
                diffMode={diffMode}
                splitView={splitView}
              />
            </AccordionContent>
          </AccordionItem>

          {baseUsage !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger>Usage</AccordionTrigger>
              <AccordionContent>
                {pickDataView(
                  baseUsage,
                  usageComparables,
                  baseLogIndex,
                  comparisonLogsIndex,
                  diffMode,
                  splitView
                )}
              </AccordionContent>
            </AccordionItem>
          )}

          {Object.keys(leftover).length > 0 && (
            <AccordionItem value="metadata">
              <AccordionTrigger>Metadata</AccordionTrigger>
              <AccordionContent>
                {pickDataView(
                  leftover,
                  leftoverComparables,
                  baseLogIndex,
                  comparisonLogsIndex,
                  diffMode,
                  splitView
                )}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    );
  }

  //
  // 3) diffMode !== "none" => show diffs for messages + leftover
  //
  return (
    <div className="space-y-4 w-full">
      <p className="font-semibold border-b pb-2">Chat Comparison</p>

      {/* Message diffs */}
      <div className="space-y-6 w-full">
        {unified.map((block, i) => {
          const msgs = gatherAll(block);
          if (!msgs.length) return null;

          // Group by role => user or assistant
          const roles = Array.from(new Set(msgs.map((m) => m.role)));

          return (
            <div key={i} className="space-y-4 w-full">
              {roles.map((role) => {
                // All messages for this role at this index
                const roleMsgs = msgs.filter((m) => m.role === role);
                if (!roleMsgs.length) return null;

                // The base message (if any)
                const baseMsg = roleMsgs.find((m) => m.isBase);
                const compMsgs = roleMsgs.filter((m) => !m.isBase);

                // If no base & no comps => skip
                if (!baseMsg && compMsgs.length === 0) return null;

                // Base content
                const baseStr = baseMsg
                  ? JSON.stringify(baseMsg.content ?? "", null, 2)
                  : "";

                let label = role === "user" ? "User" : "Assistant";

                return (
                  <div
                    key={`${i}-${role}`}
                    className="hover:border hover:border-muted bg-background p-4 rounded shadow-sm w-full"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold text-sm">{label}</p>
                      <CopyButton
                        content={baseStr}
                        copyMessage="Copied!"
                      />
                    </div>

                    {/* Compare each comp against the base (or empty string if no base) */}
                    {compMsgs.length > 0 ? (
                      compMsgs.map((cm, idx2) => {
                        const cStr = JSON.stringify(cm.content ?? "", null, 2);
                        const same = cStr === baseStr;
                        const baseBadge = same ? "none" : "delete";
                        const compBadge = same ? "none" : "insert";

                        return (
                          <div
                            key={idx2}
                            className="mt-4 bg-background p-2 rounded text-xs space-y-2 relative"
                          >
                            <div className="flex gap-2 text-xxs">
                              {baseMsg && (
                                <RowBadge
                                  rowNumbers={[baseMsg.rowIndex]}
                                  mode={baseBadge}
                                />
                              )}
                              <RowBadge
                                rowNumbers={[cm.rowIndex]}
                                mode={compBadge}
                              />
                            </div>
                            <DiffViewer
                              oldValue={baseStr}
                              newValue={cStr}
                              splitView={splitView}
                              mode={diffMode}
                            />
                          </div>
                        );
                      })
                    ) : (
                      // No comps => diff base vs empty
                      <div className="mt-4 bg-background p-2 rounded text-xs space-y-2 relative">
                        <div className="flex gap-2 text-xxs">
                          {baseMsg && (
                            <RowBadge
                              rowNumbers={[baseMsg.rowIndex]}
                              mode="delete"
                            />
                          )}
                          <RowBadge rowNumbers={[-1]} mode="insert" />
                        </div>
                        <DiffViewer
                          oldValue={baseStr}
                          newValue=""
                          splitView={splitView}
                          mode={diffMode}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Additional data => Model, usage, leftover (multi) */}
      <Accordion type="multiple" className="space-y-2">
        {/* Model diffs */}
        <AccordionItem value="model">
          <AccordionTrigger>Model</AccordionTrigger>
          <AccordionContent>
            <StringView
              value={baseModel}
              comparables={compModels}
              baseLogIndex={baseLogIndex}
              comparisonLogsIndex={comparisonLogsIndex}
              diffMode={diffMode}
              splitView={splitView}
            />
          </AccordionContent>
        </AccordionItem>

        {baseUsage !== undefined && (
          <AccordionItem value="usage">
            <AccordionTrigger>Usage</AccordionTrigger>
            <AccordionContent>
              {pickDataView(
                baseUsage,
                usageComparables,
                baseLogIndex,
                comparisonLogsIndex,
                diffMode,
                splitView
              )}
            </AccordionContent>
          </AccordionItem>
        )}

        {Object.keys(leftover).length > 0 && (
          <AccordionItem value="metadata">
            <AccordionTrigger>Metadata</AccordionTrigger>
            <AccordionContent>
              {pickDataView(
                leftover,
                leftoverComparables,
                baseLogIndex,
                comparisonLogsIndex,
                diffMode,
                splitView
              )}
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}