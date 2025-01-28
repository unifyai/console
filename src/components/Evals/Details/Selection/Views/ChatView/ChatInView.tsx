"use client";

import React, { useState } from "react";
import { LogComparisonProps } from "../types";
import RowBadge from "../RowBadge";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/UI/accordion";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import MarkdownRenderer from "../MarkdownRenderer";
import DiffViewer from "@/components/Common/Misc/DiffViewer"; // If you have this. Otherwise remove.

import { ChatBubble, ChatBubbleMessage } from "@/components/UI/Chat/chat-bubble";

// Import the “Views” to render usage/metadata
import DictionaryView from "./../DictionaryView";
import ListView from "./../ListView";
import ImageView from "./../ImageView";
import MatrixView from "./../MatrixView";
import StringView from "./../StringView";
import NumberView from "./../NumberView";
import TimestampView from "./../TimestampView";
import { isDict, isList, isMatrix, isImage, isNumber, isTimestamp, isChat } from "@/utils/evals/selection";

// A tiny helper to pick the correct data view from the existing “Views”.
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

export default function ChatInView({
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

  //--------------------------------------------
  // SINGLE MODE => Render the conversation + usage/metadata
  //--------------------------------------------
  if (singleMode) {
    const chatObj = (value && typeof value === "object") ? (value as Record<string, any>) : {};
    const messages = Array.isArray(chatObj.messages) ? chatObj.messages : [];
    const usage = chatObj.usage; // may be object or other
    const metadata: Record<string, any> = { ...chatObj };
    delete metadata.messages;
    delete metadata.usage;
    delete metadata.model;

    // If the entire “value” includes a model name, we’ll note it
    const overallModel = chatObj.model || "unknown";

    return (
      <div className="space-y-4">
        {/* 1) Messages in a scrollable region */}
        {messages.length > 0 && (
          <div className="space-y-2">
            <p className="font-semibold">Chat</p>
            {/* Scroll area */}
            <div className="h-[300px] overflow-y-auto flex flex-col gap-2 bg-background border-b">
              {messages.map((m: any, idx: number) => {
                const role = m.role || "user";
                const content = m.content || "";
                const isUser = role === "user";

                // If role='assistant', show model name in header
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
                      <div className="flex justify-between items-center mb-1 gap-2">
                        <p className="font-medium text-sm">{label}</p>
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

        {/* 2) usage + metadata => show with existing “Views” in accordions */}
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

  //--------------------------------------------
  // MULTI MODE => Compare JSON strings or highlight diffs
  //--------------------------------------------
  // Convert base + comps => JSON
  const baseJson = JSON.stringify(value, null, 2);
  const compJsons = (comparables ?? []).map((c) => JSON.stringify(c, null, 2));

  if (diffMode !== "none") {
    // lines/words/characters => highlight
    const rowIdx = [baseLogIndex, ...comparisonLogsIndex];
    const map = new Map<string, number[]>();
    compJsons.forEach((txt, i) => {
      const row = comparisonLogsIndex[i];
      if (!map.has(txt)) map.set(txt, []);
      map.get(txt)!.push(row);
    });
    const compBlocks = Array.from(map.entries()).map(([txtVal, rows]) => ({
      txtVal,
      rows: rows.sort((a, b) => a - b),
    }));

    return (
      <div className="space-y-4">
        {compBlocks.map((block, idx) => {
          const { txtVal, rows } = block;
          const changed = (baseJson !== txtVal);
          const baseBadgeMode: "none"|"delete" = changed ? "delete" : "none";
          const compBadgeMode: "none"|"insert" = changed ? "insert" : "none";

          return (
            <div key={idx} className="space-y-4 border p-3 rounded">
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

  // diffMode = "none" => group identical
  const rowAll = [baseLogIndex, ...comparisonLogsIndex];
  const map = new Map<string, number[]>();
  [baseJson, ...compJsons].forEach((txt, i) => {
    const row = rowAll[i];
    if (!map.has(txt)) map.set(txt, []);
    map.get(txt)!.push(row);
  });
  const blocks = Array.from(map.entries()).map(([txtVal, rows]) => ({
    txtVal,
    rows: rows.sort((a, b) => a - b),
  }));

  return (
    <div className="space-y-4">
      {blocks.map((block, i) => (
        <div key={i} className="p-3 border rounded relative space-y-2 bg-background">
          <RowBadge rowNumbers={block.rows} mode="none" />
          <CopyButton
            className="absolute top-1 right-1"
            content={block.txtVal}
            copyMessage="Copied JSON!"
          />
          <pre className="mt-6 text-sm whitespace-pre-wrap overflow-x-auto">
            {block.txtVal}
          </pre>
        </div>
      ))}
    </div>
  );
}