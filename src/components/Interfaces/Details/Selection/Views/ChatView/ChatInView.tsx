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
import MarkdownRenderer from "../Markdown/MarkdownRenderer";
import DiffViewer from "@/components/Common/Misc/DiffViewer";
import { MessageSquare, BarChart2, FileText, Component } from "lucide-react";

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
 * A tiny helper to capitalize the role for display.
 */
function formatRole(role: string) {
  if (!role) {
    return "Assistant";
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

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
  splitView: boolean,
  displayMode: LogComparisonProps["displayMode"],
  cellEditMode?: boolean,
  onSaveEdit?: LogComparisonProps["onSaveEdit"],
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'],
  isImmutable?: boolean
) {
  // Decide which specialized view to use.

  let finalValue = baseValue;
  if (finalValue === undefined && comparables && comparables.length > 0) {
    finalValue = comparables.find((c) => c !== undefined);
  }

  const commonProps = {
      value: baseValue,
      comparables: comparables,
      baseLogIndex: baseLogIndex,
      comparisonLogsIndex: compLogIndexes,
      diffMode: diffMode,
      splitView: splitView,
      displayMode: displayMode,
      cellEditMode: cellEditMode,
      onSaveEdit: onSaveEdit, // Pass single save
      onGroupSaveEdit: onGroupSaveEdit, 
  }

  if (isDict(finalValue)) {
    return <DictionaryView {...commonProps} isImmutable={isImmutable}/>;
  }
  if (isList(finalValue)) {
    return <ListView {...commonProps} isImmutable={isImmutable}/>;
  }
  if (isImage(finalValue)) {
    return <ImageView {...commonProps} />;
  }
  if (isMatrix(finalValue)) {
    return <MatrixView {...commonProps}/>;
  }
  if (isNumber(finalValue)) {
    return <NumberView {...commonProps} isImmutable={isImmutable}/>;
  }
  if (isTimestamp(finalValue)) {
    return <TimestampView {...commonProps} isImmutable={isImmutable}/>;
  }

  // fallback => string
  return <StringView {...commonProps} isImmutable={isImmutable}/>;
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
  displayMode = "markdown",
  isImmutable,
  cellEditMode = false,
  onSaveEdit,
  onGroupSaveEdit,
  path = [],
}: LogComparisonProps & {isImmutable?: boolean}) {
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
    const model = leftover.model ?? "";
    delete leftover.model;

    // Build path for child views
    const usagePath = [...path, 'usage'];
    const metadataPath = [...path]; // Use base path for leftover items

    return (
      <div className="space-y-4 w-full">
        {/* Update the chat messages accordion to match others */}
        <Accordion type="multiple" defaultValue={["chat"]} className="space-y-2">
          {messages.length > 0 && (
            <AccordionItem value="chat">
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>Chat</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l ml-4 pl-1 space-y-4">
                  {messages.map((m: any, idx: number) => {
                    const role = m.role ?? "assistant";
                    const label = formatRole(role);
                    const messagePath = [...path, 'messages', idx, 'content']; // Path to message content

                    return (
                      <div
                        key={idx}
                        className="border border-muted bg-background p-4 rounded shadow-sm w-full"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="font-bold text-sm">{label}</p>
                          <CopyButton
                            content={JSON.stringify(m.content ?? "")}
                            copyMessage="Copied!"
                          />
                        </div>
                        {/* Pass edit props down to potentially editable content */}
                        {pickDataView(m.content, [], baseLogIndex, [], "none", false, displayMode, cellEditMode, onSaveEdit, onGroupSaveEdit, isImmutable)}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Model + usage + metadata sections */}
          {model && (
            <AccordionItem value="model">
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Component className="h-4 w-4 text-primary" />
                  <span>Model</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l ml-4 pl-1">
                  <StringView
                    value={model}
                    comparables={[]}
                    baseLogIndex={baseLogIndex}
                    comparisonLogsIndex={[]}
                    diffMode={diffMode}
                    splitView={splitView}
                    displayMode={displayMode}
                    cellEditMode={cellEditMode}
                    onSaveEdit={onSaveEdit}
                    onGroupSaveEdit={onGroupSaveEdit}
                    path={[...path, 'model']}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {usage !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <span>Usage</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l ml-4 pl-1">
                  {pickDataView(usage, [], baseLogIndex, [], diffMode, splitView, displayMode, cellEditMode, onSaveEdit, onGroupSaveEdit, isImmutable)}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {Object.keys(leftover).length > 0 && (
            <AccordionItem value="metadata">
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Metadata</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l ml-4 pl-1">
                  {pickDataView(leftover, [], baseLogIndex, [], diffMode, splitView, displayMode, cellEditMode, onSaveEdit, onGroupSaveEdit, isImmutable)}
                </div>
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
    delete cObj.model;
    return cObj;
  });
  const compModels = compObjs.map((co) => co.model ?? "");

  // unify them
  const unified = unifyMessages(baseArr, compArrs);

  /**
   * gatherAll => collects the base (if present) plus each comparable message or (if missing) an empty string,
   * ensuring the role for missing comps is "assistant" if none is known.
   */
  function gatherAll(idxData: { baseMsg?: any; compMsgs: (any | null)[] }) {
    const out: {
      isBase: boolean;
      role: string;
      rowIndex: number;
      content: any;
    }[] = [];

    if (idxData.baseMsg) {
      const bRole = idxData.baseMsg.role ?? "assistant";
      out.push({
        isBase: true,
        role: bRole,
        rowIndex: baseLogIndex,
        content: idxData.baseMsg.content,
      });
    }

    idxData.compMsgs.forEach((cm, i) => {
      if (!cm) {
        // If missing, create an empty message with a fallback role
        const fallbackRole = idxData.baseMsg ? idxData.baseMsg.role ?? "assistant" : "assistant";
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
        <Accordion
          type="multiple"
          defaultValue={["chat"]}
          className="space-y-2"
        >
          <AccordionItem value="chat">
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>Chat Comparison</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-6 w-full">
                {unified.map((block, i) => {
                  const msgs = gatherAll(block);
                  if (!msgs.length) return null;

                  // Filter out cases where all messages are empty
                  const allEmpty = msgs.every(m =>
                    !m.content ||
                    (typeof m.content === 'string' && m.content.trim() === '') ||
                    (typeof m.content === 'object' && Object.keys(m.content).length === 0)
                  );
                  if (allEmpty) return null;

                  // We'll keep the existing logic of "userParts" vs. "non-userParts",
                  // but the role label is now generic.
                  const userParts = msgs.filter((m) => m.role === "user");
                  const asstParts = msgs.filter((m) => m.role !== "user");

                  return (
                    <div key={i} className="flex flex-col gap-6 w-full">
                      {/* Assistant side => everything that's not user */}
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
                              const label = formatRole(m.role);
                              return (
                                <TabsContent
                                  key={m.rowIndex}
                                  value={String(m.rowIndex)}
                                  className="w-full"
                                >
                                  <div className="border border-mutedbg-background p-4 rounded shadow-sm w-full">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="font-bold text-sm">{label}</p>
                                      <CopyButton
                                        content={JSON.stringify(m.content ?? "")}
                                        copyMessage="Copied!"
                                      />
                                    </div>
                                     {/* Pass edit props down */}
                                    {pickDataView(m.content, [], m.rowIndex, [], "none", false, displayMode, cellEditMode, onSaveEdit, onGroupSaveEdit, isImmutable)}
                                  </div>
                                </TabsContent>
                              );
                            })}
                          </Tabs>
                        </div>
                      )}

                      {/* User side => those exactly with role==="user" */}
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
                                    Row {m.rowIndex + 1}
                                  </TabsTrigger>
                                ))}
                              </TabsList>
                            </div>
                            {userParts.map((m) => {
                              const label = formatRole(m.role);
                              return (
                                <TabsContent
                                  key={m.rowIndex}
                                  value={String(m.rowIndex)}
                                  className="w-full"
                                >
                                  <div className="border border-muted bg-background p-4 rounded shadow-sm w-full">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="font-bold text-sm">{label}</p>
                                      <CopyButton
                                        content={JSON.stringify(m.content ?? "")}
                                        copyMessage="Copied!"
                                      />
                                    </div>
                                     {/* Pass edit props down */}
                                     {pickDataView(m.content, [], m.rowIndex, [], "none", false, displayMode, cellEditMode, onSaveEdit, onGroupSaveEdit, isImmutable)}
                                  </div>
                                </TabsContent>
                              );
                            })}
                          </Tabs>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="model">
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <Component className="h-4 w-4 text-primary" />
                <span>Model</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="border-l ml-4 pl-1">
                <StringView
                  value={baseModel}
                  comparables={compModels}
                  baseLogIndex={baseLogIndex}
                  comparisonLogsIndex={comparisonLogsIndex}
                  diffMode={diffMode}
                  splitView={splitView}
                  cellEditMode={cellEditMode}
                  onSaveEdit={onSaveEdit}
                  onGroupSaveEdit={onGroupSaveEdit} 
                  path={[...path, 'model']} 
                />
              </div>
            </AccordionContent>
          </AccordionItem>
          {baseUsage !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <span>Usage</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l ml-4 pl-1">
                  {pickDataView(
                    baseUsage,
                    usageComparables,
                    baseLogIndex,
                    comparisonLogsIndex,
                    diffMode,
                    splitView,
                    displayMode,
                    cellEditMode,
                    onSaveEdit,
                    onGroupSaveEdit, 
                    isImmutable 
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}
          {Object.keys(leftover).length > 0 && (
            <AccordionItem value="metadata">
              <AccordionTrigger className="relative group flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Metadata</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="border-l ml-4 pl-1">
                  {pickDataView(
                    leftover,
                    leftoverComparables,
                    baseLogIndex,
                    comparisonLogsIndex,
                    diffMode,
                    splitView,
                    displayMode,
                    cellEditMode,
                    onSaveEdit,
                    onGroupSaveEdit,
                    isImmutable 
                  )}
                </div>
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
      <Accordion
        type="multiple"
        defaultValue={["chat"]}
        className="space-y-2"
      >
        <AccordionItem value="chat">
          <AccordionTrigger className="relative group flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>Chat Comparison</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6 w-full">
              {unified.map((block, i) => {
                const msgs = gatherAll(block);
                if (!msgs.length) return null;

                // Filter out cases where all messages are empty
                const allEmpty = msgs.every(m =>
                  !m.content ||
                  (typeof m.content === 'string' && m.content.trim() === '') ||
                  (typeof m.content === 'object' && Object.keys(m.content).length === 0)
                );
                if (allEmpty) return null;

                // group by role
                const roles = Array.from(new Set(msgs.map((m) => m.role)));

                return (
                  <div key={i} className="space-y-4 w-full">
                    {roles.map((role) => {
                      const roleMsgs = msgs.filter((m) => m.role === role);
                      if (!roleMsgs.length) return null;

                      const baseMsg = roleMsgs.find((m) => m.isBase);
                      const compMsgs = roleMsgs.filter((m) => !m.isBase);

                      const baseStr = baseMsg
                        ? JSON.stringify(baseMsg.content ?? "", null, 2)
                        : "";

                      const label = formatRole(role);

                      return (
                        <div
                          key={`${i}-${role}`}
                          className="border border-muted bg-background p-4 rounded shadow-sm w-full"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className="font-bold text-sm">{label}</p>
                            <CopyButton
                              content={baseStr}
                              copyMessage="Copied!"
                            />
                          </div>

                          {/* Compare each comp against the base */}
                          {compMsgs.length > 0 ? (
                            compMsgs.map((cm, idx2) => {
                              const cStr = JSON.stringify(
                                cm.content ?? "",
                                null,
                                2
                              );
                              const same = cStr === baseStr;
                              const baseBadge = same ? "none" : "delete";
                              const compBadge = same ? "none" : "insert";

                              return (
                                <div
                                  key={idx2}
                                  className="mt-4 bg-background p-2 rounded text-xs space-y-2 relative border border-muted"
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
                                    hideLineNumbers={!baseStr.includes('\n') && !cStr.includes('\n')}
                                    mode={diffMode}
                                  />
                                </div>
                              );
                            })
                          ) : (
                            /* No comparables => compare with empty */
                            <div className="mt-4 bg-background p-2 rounded text-xs space-y-2 relative border border-muted">
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
                                hideLineNumbers={!baseStr.includes('\n')}
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
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="model">
          <AccordionTrigger className="relative group flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Component className="h-4 w-4 text-primary" />
              <span>Model</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="border-l ml-4 pl-1">
              <StringView
                value={baseModel}
                comparables={compModels}
                baseLogIndex={baseLogIndex}
                comparisonLogsIndex={comparisonLogsIndex}
                diffMode={diffMode}
                splitView={splitView}
                displayMode={displayMode}
                cellEditMode={cellEditMode}
                onSaveEdit={onSaveEdit}
                onGroupSaveEdit={onGroupSaveEdit} 
                path={[...path, 'model']} 
              />
            </div>
          </AccordionContent>
        </AccordionItem>
        {baseUsage !== undefined && (
          <AccordionItem value="usage">
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                <span>Usage</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="border-l ml-4 pl-1">
                {pickDataView(
                  baseUsage,
                  usageComparables,
                  baseLogIndex,
                  comparisonLogsIndex,
                  diffMode,
                  splitView,
                  displayMode,
                  cellEditMode,
                  onSaveEdit,
                  onGroupSaveEdit,
                  isImmutable 
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
        {Object.keys(leftover).length > 0 && (
          <AccordionItem value="metadata">
            <AccordionTrigger className="relative group flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>Metadata</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="border-l ml-4 pl-1">
                {pickDataView(
                  leftover,
                  leftoverComparables,
                  baseLogIndex,
                  comparisonLogsIndex,
                  diffMode,
                  splitView,
                  displayMode,
                  cellEditMode,
                  onSaveEdit,
                  onGroupSaveEdit,
                  isImmutable 
                )}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  );
}