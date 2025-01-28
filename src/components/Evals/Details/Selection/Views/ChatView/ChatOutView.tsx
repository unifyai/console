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
 * pickDataView:
 * multi-diff for leftover/usage, if needed
 ******************************************************************************/
function pickDataView(
  baseValue: any,
  comparables: any[],
  baseLogIndex: number,
  compLogIndexes: number[],
  diffMode: LogComparisonProps["diffMode"],
  splitView: boolean
) {
  // Determine finalValue from baseValue or fallback 
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
 * renderMessageContent => root-level text/images
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
            } else if (chunk.type === "image_url" && chunk.image_url?.url) {
              return (
                <img key={i} src={chunk.image_url.url} alt={`Image ${i}`} />
              );
            }
            // default => show JSON
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
 * unifyChoices => merges base + comparable "choices" by index
 ******************************************************************************/
function unifyChoices(baseArr: any[], compArrs: any[][]) {
  const maxLen = Math.max(baseArr.length, ...compArrs.map((arr) => arr.length));
  const out: {
    index: number;
    baseChoice?: any;
    compChoices: (any | null)[];
  }[] = [];
  for (let i = 0; i < maxLen; i++) {
    out.push({
      index: i,
      baseChoice: baseArr[i],
      compChoices: compArrs.map((c) => c[i] ?? null),
    });
  }
  return out;
}

/******************************************************************************
 * ChatOutView: single vs multi approach
 ******************************************************************************/
export default function ChatOutView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
}: LogComparisonProps) {
  // SINGLE MODE
  const singleMode = !comparables || comparables.length === 0;
  if (singleMode) {
    const chatObj = (value && typeof value === "object") ? value : {};
    const choicesArr = Array.isArray(chatObj.choices) ? chatObj.choices : [];
    const usage = chatObj.usage;
    const leftover: Record<string, any> = { ...chatObj };
    delete leftover.choices;
    delete leftover.usage;
    const model = leftover.model ?? "";
    delete leftover.model;

    return (
      <div className="space-y-4">
        {/* PART 1: conversation from choices */}
        {choicesArr.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold border-b pb-2">Chat Output</p>
            <div className="flex flex-col gap-3 p-2">
              {choicesArr.map((choice: any, idx: number) => {
                const role = choice.message?.role || "assistant";
                const label = role === "system" ? "System" : "Assistant";
                const mainContent = choice.message?.content ?? "";
                const toolCalls = choice.message?.tool_calls ?? [];

                return (
                  <div
                    key={idx}
                    className="hover:border hover:border-muted bg-background p-4 rounded shadow-sm w-full"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold text-sm">{label}</p>
                      <CopyButton
                        content={JSON.stringify(mainContent)}
                        copyMessage="Copied!"
                      />
                    </div>
                    {renderMessageContent(mainContent)}

                    {/* Plain JSON for tool calls (if any) */}
                    {toolCalls.length > 0 && (
                      <div className="mt-2 border-l-2 pl-2">
                        <p className="font-bold text-sm mb-1">Tool Calls</p>
                        <CopyButton
                          className="mb-1"
                          content={JSON.stringify(toolCalls, null, 2)}
                          copyMessage="Copied!"
                        />
                        <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap">
                          {JSON.stringify(toolCalls, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PART 2: Model, usage, leftover metadata */}
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

  // MULTI MODE
  const baseObj = (value && typeof value === "object") ? value : {};
  const compObjs = (comparables ?? []).map((co) =>
    co && typeof co === "object" ? co : {}
  );

  // unify “choices”
  const baseChoices = Array.isArray(baseObj.choices) ? baseObj.choices : [];
  const compChoiceArrays = compObjs.map((o) =>
    Array.isArray(o.choices) ? o.choices : []
  );
  const unified = unifyChoices(baseChoices, compChoiceArrays);

  // usage leftover 
  const usageBase = baseObj.usage;
  const usageComps = compObjs.map((co) => co.usage);
  const leftover: Record<string, any> = { ...baseObj };
  delete leftover.choices;
  delete leftover.usage;
  const baseModel = leftover.model ?? "";
  delete leftover.model;

  // leftoverComparables => for each compObj
  const leftoverComparables = compObjs.map((co) => {
    const cObj = { ...co };
    delete cObj.choices;
    delete cObj.usage;
    const cModel = cObj.model; // handled separately
    delete cObj.model;
    return cObj;
  });
  // model array
  const compModels = compObjs.map((co) => co.model ?? "");

  /**
   * gatherAll => returns an array of { isBase, role, rowIndex, content, toolCalls }
   * so we can do diffs (like in ChatInView).
   */
  function gatherAll(u: { baseChoice?: any; compChoices: (any | null)[] }) {
    const out: {
      isBase: boolean;
      role: string;
      rowIndex: number;
      content: any;
      toolCalls: any[];
    }[] = [];

    if (u.baseChoice) {
      const role = u.baseChoice.message?.role ?? "assistant";
      const content = u.baseChoice.message?.content ?? "";
      const toolCalls = u.baseChoice.message?.tool_calls ?? [];
      out.push({
        isBase: true,
        role,
        rowIndex: baseLogIndex,
        content,
        toolCalls,
      });
    }

    u.compChoices.forEach((cc, i) => {
      if (!cc) {
        out.push({
          isBase: false,
          role: "assistant",
          rowIndex: comparisonLogsIndex[i],
          content: "",
          toolCalls: [],
        });
      } else {
        const role = cc.message?.role ?? "assistant";
        const content = cc.message?.content ?? "";
        const toolCalls = cc.message?.tool_calls ?? [];
        out.push({
          isBase: false,
          role,
          rowIndex: comparisonLogsIndex[i],
          content,
          toolCalls,
        });
      }
    });
    return out;
  }

  if (diffMode === "none") {
    // TAB approach for messages, same as ChatInView
    return (
      <div className="space-y-4 w-full">
        <p className="font-semibold border-b pb-2">Chat Output Comparison</p>

        {/* message blocks */}
        <div className="space-y-6 w-full">
          {unified.map((block, i) => {
            const combined = gatherAll(block);
            if (!combined.length) return null;
            const userParts = combined.filter((m) => m.role === "user");
            const asstParts = combined.filter((m) => m.role !== "user");

            return (
              <div key={i} className="flex flex-col gap-6 w-full">
                {/* assistant */}
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
                      {asstParts.map((m) => (
                        <TabsContent
                          key={m.rowIndex}
                          value={String(m.rowIndex)}
                          className="w-full"
                        >
                          <div className="border bg-background p-4 rounded shadow-sm w-full">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-bold text-sm">Assistant</p>
                              <CopyButton
                                content={JSON.stringify(m.content)}
                                copyMessage="Copied!"
                              />
                            </div>
                            {renderMessageContent(m.content)}

                            {m.toolCalls.length > 0 && (
                              <div className="mt-2 border-l-2 pl-2">
                                <p className="font-bold text-sm mb-1">
                                  Tool Calls
                                </p>
                                <CopyButton
                                  className="mb-1"
                                  content={JSON.stringify(m.toolCalls, null, 2)}
                                  copyMessage="Copied!"
                                />
                                <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap">
                                  {JSON.stringify(m.toolCalls, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </TabsContent>
                      ))}
                    </Tabs>
                  </div>
                )}
                {/* user */}
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
                          <div className="border bg-background p-4 rounded shadow-sm w-full">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="font-bold text-sm">User</p>
                              <CopyButton
                                content={JSON.stringify(m.content)}
                                copyMessage="Copied!"
                              />
                            </div>
                            {renderMessageContent(m.content)}

                            {m.toolCalls.length > 0 && (
                              <div className="mt-2 border-l-2 pl-2">
                                <p className="font-bold text-sm mb-1">
                                  Tool Calls
                                </p>
                                <CopyButton
                                  className="mb-1"
                                  content={JSON.stringify(m.toolCalls, null, 2)}
                                  copyMessage="Copied!"
                                />
                                <pre className="bg-muted p-2 rounded text-xs whitespace-pre-wrap">
                                  {JSON.stringify(m.toolCalls, null, 2)}
                                </pre>
                              </div>
                            )}
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

        {/* multi leftover diffs */}
        <Accordion type="multiple" className="space-y-2">
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

          {usageBase !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger>Usage</AccordionTrigger>
              <AccordionContent>
                {pickDataView(
                  usageBase,
                  usageComps,
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

  // diffMode !== "none" => we do side-by-side diffs
  return (
    <div className="space-y-4">
      <p className="font-semibold border-b pb-2">Chat Output Comparison</p>

      <div className="space-y-6">
        {/* message diffs */}
        {unified.map((block, i) => {
          const combined = gatherAll(block);
          if (!combined.length) return null;

          const roles = Array.from(new Set(combined.map((m) => m.role)));
          return (
            <div key={i} className="space-y-4">
              {roles.map((role) => {
                const roleMsgs = combined.filter((m) => m.role === role);
                if (!roleMsgs.length) return null;

                const baseMsg = roleMsgs.find((r) => r.isBase);
                const compMsgs = roleMsgs.filter((r) => !r.isBase);
                if (!baseMsg && compMsgs.length === 0) return null;

                // main content
                const baseStr = baseMsg
                  ? JSON.stringify(baseMsg.content, null, 2)
                  : "";
                // for tool calls
                const baseToolJSON = baseMsg
                  ? JSON.stringify(baseMsg.toolCalls, null, 2)
                  : "";

                return (
                  <div
                    key={`${i}-${role}`}
                    className="bg-background p-4 rounded shadow-sm hover:border hover:border-muted"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-bold text-sm">
                        {role === "user" ? "User" : "Assistant"}
                      </p>
                      <CopyButton content={baseStr} copyMessage="Copied!" />
                    </div>

                    {/* content diffs */}
                    {compMsgs.length > 0 ? (
                      compMsgs.map((cm, idx2) => {
                        const cStr = JSON.stringify(cm.content, null, 2);
                        const same = cStr === baseStr;
                        const baseMode = same ? "none" : "delete";
                        const compMode = same ? "none" : "insert";
                        return (
                          <div
                            key={idx2}
                            className="mt-4 bg-background p-2 rounded text-xs space-y-2 relative"
                          >
                            <div className="flex gap-2 text-xxs">
                              {baseMsg && (
                                <RowBadge
                                  rowNumbers={[baseMsg.rowIndex]}
                                  mode={baseMode}
                                />
                              )}
                              <RowBadge
                                rowNumbers={[cm.rowIndex]}
                                mode={compMode}
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

                    {/* tool call diffs */}
                    {(() => {
                      const hasBaseTools =
                        baseMsg && baseMsg.toolCalls && baseMsg.toolCalls.length > 0;
                      const anyCompTools = compMsgs.some(
                        (c) => c.toolCalls && c.toolCalls.length > 0
                      );
                      if (hasBaseTools || anyCompTools) {
                        return (
                          <div className="mt-6 pt-2 border-t border-muted space-y-2">
                            <p className="font-bold text-xs">Tool Calls Diff</p>
                            {compMsgs.length > 0 ? (
                              compMsgs.map((cm, idx3) => {
                                const cTools = JSON.stringify(cm.toolCalls, null, 2);
                                const sameTools = cTools === baseToolJSON;
                                const baseBadge = sameTools ? "none" : "delete";
                                const compBadge = sameTools ? "none" : "insert";
                                return (
                                  <div
                                    key={idx3}
                                    className="bg-background p-2 rounded text-xs space-y-2 relative"
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
                                      oldValue={baseToolJSON}
                                      newValue={cTools}
                                      splitView={splitView}
                                      mode={diffMode}
                                    />
                                  </div>
                                );
                              })
                            ) : (
                              <div className="bg-background p-2 rounded text-xs space-y-2 relative">
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
                                  oldValue={baseToolJSON}
                                  newValue=""
                                  splitView={splitView}
                                  mode={diffMode}
                                />
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* leftover diffs => model, usage, leftover */}
      <Accordion type="multiple" className="space-y-2">
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

        {usageBase !== undefined && (
          <AccordionItem value="usage">
            <AccordionTrigger>Usage</AccordionTrigger>
            <AccordionContent>
              {pickDataView(
                usageBase,
                usageComps,
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