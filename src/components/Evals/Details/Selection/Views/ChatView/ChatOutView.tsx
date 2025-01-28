"use client";

import React from "react";
import { LogComparisonProps } from "../types";
import RowBadge from "../RowBadge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/UI/accordion";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "../MarkdownRenderer";
import DiffViewer from "@/components/Common/Misc/DiffViewer"; // If you have it. Otherwise, remove.

import { ChatBubble, ChatBubbleMessage } from "@/components/UI/Chat/chat-bubble";

// “Views” for usage/metadata
import DictionaryView from "./../DictionaryView";
import ListView from "./../ListView";
import ImageView from "./../ImageView";
import MatrixView from "./../MatrixView";
import StringView from "./../StringView";
import NumberView from "./../NumberView";
import TimestampView from "./../TimestampView";
import { isDict, isList, isMatrix, isImage, isNumber, isTimestamp } from "@/utils/evals/selection";

// pickDataView helper
function pickDataView(
  value: any,
  baseLogIndex: number = 1,
  comparisonLogsIndex: number[] = [],
  diffMode: LogComparisonProps["diffMode"] = "none",
  splitView: boolean = false
) {
  if (isDict(value)) {
    return (
      <DictionaryView
        value={value}
        comparables={[]}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isList(value)) {
    return (
      <ListView
        value={value}
        comparables={[]}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isImage(value)) {
    return (
      <ImageView
        value={value}
        comparables={[]}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isMatrix(value)) {
    return (
      <MatrixView
        value={value}
        comparables={[]}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isNumber(value)) {
    return (
      <NumberView
        value={value}
        comparables={[]}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  if (isTimestamp(value)) {
    return (
      <TimestampView
        value={value}
        comparables={[]}
        baseLogIndex={baseLogIndex}
        comparisonLogsIndex={comparisonLogsIndex}
        diffMode={diffMode}
        splitView={splitView}
      />
    );
  }
  // fallback => string
  return (
    <StringView
      value={value}
      comparables={[]}
      baseLogIndex={baseLogIndex}
      comparisonLogsIndex={comparisonLogsIndex}
      diffMode={diffMode}
      splitView={splitView}
    />
  );
}

export default function ChatOutView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = "none",
  splitView = false,
  version = "",
  comparableVersions = [],
}: LogComparisonProps) {
  const singleMode = !comparables || comparables.length === 0;

  console.log(value)

  //-----------------------------
  // SINGLE MODE => Show conversation bubbles + usage + metadata
  //-----------------------------
  if (singleMode) {
    const chatObj = (value && typeof value === "object") ? (value as Record<string, any>) : {};
    const choicesArr = Array.isArray(chatObj.choices) ? chatObj.choices : [];
    // usage might be any shape
    const usage = chatObj.usage;
    // gather metadata (excluding “choices”, “usage”, “id”, “model”)
    const metadata: Record<string, any> = { ...chatObj };
    delete metadata.choices;
    delete metadata.usage;
    delete metadata.id;
    delete metadata.model;

    // If there's a top-level “model”
    const overallModel = chatObj.model || "unknown";

    return (
      <div className="space-y-4">
        {/* 1) Show “choices” as conversation in a scrollable region */}
        {choicesArr.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold">Chat</p>
            <div className="h-[300px] overflow-y-auto flex flex-col gap-3 border-b bg-background">
              {choicesArr.map((choice: any, idx: number) => {
                const role = choice.message?.role || "assistant";
                const content = choice.message?.content || "";
                const isUser = role === "user";

                const label = isUser
                  ? `User`
                  : `Assistant`;

                return (
                  <ChatBubble
                    key={idx}
                    variant={isUser ? "sent" : "received"}
                  >
                    <ChatBubbleMessage
                      variant={isUser ? "sent" : "received"}
                      isLoading={false}
                    >
                      <div className="flex justify-between items-center mb-1 border-b pb-1 gap-2">
                        <p className="font-medium text-sm">
                          {label}
                        </p>
                        {overallModel && !isUser && (
                          <p className="font-small text-sm text-muted-foreground">
                            {overallModel}
                          </p>
                        )}
                        <CopyButton
                          className="text-gray-400 hover:text-gray-700"
                          content={content}
                          copyMessage="Copied!"
                          tooltipContent="Copy message"
                        />
                      </div>
                      <MarkdownRenderer>{content}</MarkdownRenderer>
                    </ChatBubbleMessage>
                  </ChatBubble>
                );
              })}
            </div>
          </div>
        )}

        {/* 2) usage + leftover metadata as “Views” in accordions */}
        <Accordion type="multiple" className="space-y-2">
          {usage !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger>Usage</AccordionTrigger>
              <AccordionContent>
                {pickDataView(usage, baseLogIndex, [], diffMode, splitView)}
              </AccordionContent>
            </AccordionItem>
          )}
          {Object.keys(metadata).length > 0 && (
            <AccordionItem value="metadata">
              <AccordionTrigger>Metadata</AccordionTrigger>
              <AccordionContent>
                {pickDataView(metadata, baseLogIndex, [], diffMode, splitView)}
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>
      </div>
    );
  }

  //-----------------------------
  // MULTI MODE => standard grouping/diff approach
  //-----------------------------
  const baseJson = JSON.stringify(value, null, 2);
  const compJsons = (comparables ?? []).map((c) => JSON.stringify(c, null, 2));

  if (diffMode !== "none") {
    const rowIdxs = [baseLogIndex, ...comparisonLogsIndex];
    const map = new Map<string, number[]>();
    compJsons.forEach((txt, i) => {
      const row = comparisonLogsIndex[i];
      if (!map.has(txt)) map.set(txt, []);
      map.get(txt)!.push(row);
    });
    const blocks = Array.from(map.entries()).map(([txtVal, rows]) => ({
      txtVal,
      rows: rows.sort((a, b) => a - b),
    }));

    return (
      <div className="space-y-4">
        {blocks.map((block, i) => {
          const { txtVal, rows } = block;
          const changed = (baseJson !== txtVal);
          const baseBadgeMode = changed ? "delete" : "none";
          const compBadgeMode = changed ? "insert" : "none";

          return (
            <div key={i} className="border rounded p-3 space-y-4">
              <div className="flex items-center gap-2 text-xs">
                <RowBadge rowNumbers={[baseLogIndex]} mode={baseBadgeMode} />
                <RowBadge rowNumbers={rows} mode={compBadgeMode} />
              </div>
              <DiffViewer
                oldValue={baseJson}
                newValue={txtVal}
                splitView={splitView}
                hideLineNumbers={false}
                hideMarkers
                mode={diffMode}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // diffMode="none"
  const rowAll = [baseLogIndex, ...comparisonLogsIndex];
  const map = new Map<string, number[]>();
  [baseJson, ...compJsons].forEach((txtVal, i) => {
    const r = rowAll[i];
    if (!map.has(txtVal)) map.set(txtVal, []);
    map.get(txtVal)!.push(r);
  });
  const groupArr = Array.from(map.entries()).map(([txtVal, rows]) => ({
    txtVal,
    rows: rows.sort((a, b) => a - b),
  }));

  return (
    <div className="space-y-4">
      {groupArr.map((grp, i) => (
        <div key={i} className="border rounded p-2 relative space-y-2 bg-background">
          <RowBadge rowNumbers={grp.rows} mode="none" />
          <CopyButton
            className="absolute top-1 right-1"
            content={grp.txtVal}
          />
          <pre className="mt-6 text-sm whitespace-pre-wrap overflow-x-auto">
            {grp.txtVal}
          </pre>
        </div>
      ))}
    </div>
  );
}