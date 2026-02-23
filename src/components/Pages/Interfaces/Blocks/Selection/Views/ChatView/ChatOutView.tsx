'use client';

import React from 'react';
import Image from 'next/image';
import { LogComparisonProps } from '../types';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/UI/accordion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/UI/tabs';
import { CopyButton } from '@/components/Common/Buttons/Copy';
import RowBadge from '../RowBadge';
import MarkdownRenderer from '../Markdown/MarkdownRenderer';
import DiffViewer from '@/components/Common/Misc/DiffViewer';

import DictionaryView from '../DictionaryView';
import ListView from '../ListView';
import ImageView from '../ImageView';
import MatrixView from '../MatrixView';
import StringView from '../StringView';
import NumberView from '../NumberView';
import TimestampView from '../TimestampView';

import {
  isDict,
  isList,
  isImage,
  isMatrix,
  isNumber,
  isTimestamp,
  AudioPlayer,
  isAudio,
} from '@/utils/interfaces/selection/selection';
import { MessageSquare, BarChart2, FileText, Component } from 'lucide-react';
import { LogsActions } from '@/types/interfaces/grid';
import { LogProps } from '@/types/interfaces/logs';

/******************************************************************************
 * A tiny helper to capitalize or otherwise format a role for display.
 */
function formatRole(role: string) {
  if (!role) {
    return 'Assistant';
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/******************************************************************************
 * pickDataView:
 * multi-diff for leftover/usage, if needed
 ******************************************************************************/
function pickDataView(
  baseValue: any,
  comparables: any[],
  baseLogIndex: number,
  compLogIndexes: number[],
  diffMode: LogComparisonProps['diffMode'],
  splitView: boolean,
  displayMode: LogComparisonProps['displayMode'],
  fieldName: string,
  context: string | null,
  baseLog: LogProps | undefined,
  comparisonLogs: LogProps[] | undefined,
  logsActions?: LogsActions,
  cellEditMode?: boolean,
  onSaveEdit?: LogComparisonProps['onSaveEdit'],
  onGroupSaveEdit?: LogComparisonProps['onGroupSaveEdit'],
  isImmutable?: boolean
) {
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
    onSaveEdit: onSaveEdit,
    onGroupSaveEdit: onGroupSaveEdit,
  };

  if (isDict(finalValue)) {
    return (
      <DictionaryView
        {...commonProps}
        isImmutable={isImmutable}
        logsActions={logsActions}
        context={context}
        baseLog={baseLog}
        comparisonLogs={comparisonLogs}
        fieldName={fieldName}
      />
    );
  }
  if (isList(finalValue)) {
    return (
      <ListView
        {...commonProps}
        isImmutable={isImmutable}
        logsActions={logsActions}
        context={context}
        baseLog={baseLog}
        comparisonLogs={comparisonLogs}
        fieldName={fieldName}
      />
    );
  }
  if (isImage(finalValue)) {
    return <ImageView {...commonProps} />;
  }
  if (isAudio(finalValue)) {
    return <AudioPlayer {...commonProps} />;
  }
  if (isMatrix(finalValue)) {
    return <MatrixView {...commonProps} />;
  }
  if (isNumber(finalValue)) {
    return <NumberView {...commonProps} isImmutable={isImmutable} />;
  }
  if (isTimestamp(finalValue)) {
    return <TimestampView {...commonProps} isImmutable={isImmutable} />;
  }
  // fallback => string
  return <StringView {...commonProps} isImmutable={isImmutable} />;
}

/******************************************************************************
 * renderMessageContent => root-level text/images
 ******************************************************************************/
function renderMessageContent(content: unknown): JSX.Element {
  if (typeof content === 'string') {
    return <MarkdownRenderer>{content}</MarkdownRenderer>;
  }
  if (Array.isArray(content)) {
    return (
      <>
        {content.map((chunk, i) => {
          if (typeof chunk === 'string') {
            return <MarkdownRenderer key={i}>{chunk}</MarkdownRenderer>;
          }
          if (chunk && typeof chunk === 'object') {
            if (chunk.type === 'text' && typeof chunk.text === 'string') {
              return <MarkdownRenderer key={i}>{chunk.text}</MarkdownRenderer>;
            } else if (chunk.type === 'imageUrl' && chunk.imageUrl?.url) {
              return (
                <Image
                  key={i}
                  src={chunk.imageUrl.url}
                  alt={`Image ${i}`}
                  width={500}
                  height={300}
                  className="h-auto max-w-full"
                />
              );
            }
            // default => show JSON
            return (
              <pre key={i} className="text-caption rounded bg-background p-2">
                {JSON.stringify(chunk, null, 2)}
              </pre>
            );
          }
          // fallback => JSON
          return (
            <pre key={i} className="text-caption rounded bg-background p-2">
              {JSON.stringify(chunk, null, 2)}
            </pre>
          );
        })}
      </>
    );
  }
  // fallback => JSON
  return (
    <pre className="text-caption rounded bg-background p-2">{JSON.stringify(content, null, 2)}</pre>
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

export default function ChatOutView({
  value,
  comparables,
  baseLogIndex,
  comparisonLogsIndex,
  diffMode = 'none',
  isImmutable,
  splitView = false,
  displayMode = 'markdown',
  cellEditMode = false,
  onSaveEdit,
  onGroupSaveEdit,
  path = [],
  fieldName,
  context,
  baseLog,
  comparisonLogs,
  logsActions,
}: LogComparisonProps & {
  isImmutable?: boolean;
  fieldName: string;
  context: string | null;
  baseLog: LogProps | undefined;
  comparisonLogs: LogProps[] | undefined;
  logsActions?: LogsActions;
}) {
  // SINGLE MODE
  const singleMode = !comparables || comparables.length === 0;
  if (singleMode) {
    const chatObj = value && typeof value === 'object' ? value : {};
    const choicesArr = Array.isArray(chatObj.choices) ? chatObj.choices : [];
    const usage = chatObj.usage;
    const leftover: Record<string, any> = { ...chatObj };
    delete leftover.choices;
    delete leftover.usage;
    const model = leftover.model ?? '';
    delete leftover.model;

    // Build paths for child views
    const usagePath = [...path, 'usage'];
    const metadataPath = [...path]; // Base path for leftovers

    return (
      <div className="w-full space-y-4">
        <Accordion type="multiple" defaultValue={['chat']} className="space-y-2">
          {/* PART 1: conversation from choices */}
          {choicesArr.length > 0 && (
            <AccordionItem value="chat">
              <AccordionTrigger className="group relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span>Chat Output</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4 space-y-4 border-l pl-1">
                  {choicesArr.map((choice: any, idx: number) => {
                    const role = choice.message?.role || 'assistant';
                    const label = formatRole(role);
                    const mainContent = choice.message?.content ?? '';
                    const toolCalls = choice.message?.toolCalls ?? [];
                    const contentPath = [...path, 'choices', idx, 'message', 'content'];
                    const toolCallsPath = [...path, 'choices', idx, 'message', 'toolCalls'];

                    return (
                      <div
                        key={idx}
                        className="w-full rounded border border-muted bg-background p-4 shadow-sm"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-title">{label}</p>
                          <CopyButton content={JSON.stringify(mainContent)} copyMessage="Copied!" />
                        </div>
                        {/* Pass edit props down to potentially editable content */}
                        {pickDataView(
                          mainContent,
                          [],
                          baseLogIndex,
                          [],
                          'none',
                          false,
                          displayMode,
                          fieldName,
                          context,
                          baseLog,
                          comparisonLogs,
                          logsActions,
                          cellEditMode,
                          onSaveEdit,
                          onGroupSaveEdit,
                          isImmutable
                        )}

                        {/* Tool calls section */}
                        {toolCalls.length > 0 && (
                          <div className="mt-2 border-l-2 pl-2">
                            <p className="text-title mb-1">Tool Calls</p>
                            <CopyButton
                              className="mb-1"
                              content={JSON.stringify(toolCalls, null, 2)}
                              copyMessage="Copied!"
                            />
                            {/* Tool calls are usually complex, less likely to be directly edited, but pass handlers */}
                            {pickDataView(
                              toolCalls,
                              [],
                              baseLogIndex,
                              [],
                              'none',
                              false,
                              displayMode,
                              fieldName,
                              context,
                              baseLog,
                              comparisonLogs,
                              logsActions,
                              cellEditMode,
                              onSaveEdit,
                              onGroupSaveEdit,
                              isImmutable
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* PART 2: Model, usage, leftover metadata */}
          {model && (
            <AccordionItem value="model">
              <AccordionTrigger className="group relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <Component className="h-4 w-4 text-primary" />
                  <span>Model</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4 border-l pl-1">
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
              <AccordionTrigger className="group relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <span>Usage</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4 border-l pl-1">
                  {pickDataView(
                    usage,
                    [],
                    baseLogIndex,
                    [],
                    diffMode,
                    splitView,
                    displayMode,
                    fieldName,
                    context,
                    baseLog,
                    comparisonLogs,
                    logsActions,
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
              <AccordionTrigger className="group relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Metadata</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4 border-l pl-1">
                  {pickDataView(
                    leftover,
                    [],
                    baseLogIndex,
                    [],
                    diffMode,
                    splitView,
                    displayMode,
                    fieldName,
                    context,
                    baseLog,
                    comparisonLogs,
                    logsActions,
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

  // MULTI MODE
  const baseObj = value && typeof value === 'object' ? value : {};
  const compObjs = (comparables ?? []).map((co) => (co && typeof co === 'object' ? co : {}));

  // unify "choices"
  const baseChoices = Array.isArray(baseObj.choices) ? baseObj.choices : [];
  const compChoiceArrays = compObjs.map((o) => (Array.isArray(o.choices) ? o.choices : []));
  const unified = unifyChoices(baseChoices, compChoiceArrays);

  // usage leftover
  const usageBase = baseObj.usage;
  const usageComps = compObjs.map((co) => co.usage);
  const leftover: Record<string, any> = { ...baseObj };
  delete leftover.choices;
  delete leftover.usage;
  const baseModel = leftover.model ?? '';
  delete leftover.model;

  // leftoverComparables => for each compObj
  const leftoverComparables = compObjs.map((co) => {
    const cObj = { ...co };
    delete cObj.choices;
    delete cObj.usage;
    delete cObj.model;
    return cObj;
  });
  const compModels = compObjs.map((co) => co.model ?? '');

  /**
   * gatherAll => returns an array of { isBase, role, rowIndex, content, toolCalls }
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
      const role = u.baseChoice.message?.role ?? 'assistant';
      const content = u.baseChoice.message?.content ?? '';
      const toolCalls = u.baseChoice.message?.toolCalls ?? [];
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
          role: 'assistant',
          rowIndex: comparisonLogsIndex[i],
          content: '',
          toolCalls: [],
        });
      } else {
        const role = cc.message?.role ?? 'assistant';
        const content = cc.message?.content ?? '';
        const toolCalls = cc.message?.toolCalls ?? [];
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

  if (diffMode === 'none') {
    return (
      <div className="w-full space-y-4">
        <Accordion type="multiple" defaultValue={['chat']} className="space-y-2">
          <AccordionItem value="chat">
            <AccordionTrigger className="group relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span>Chat Output Comparison</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="w-full space-y-6">
                {unified.map((block, i) => {
                  const combined = gatherAll(block);
                  if (!combined.length) return null;

                  // Filter out blocks where all messages are empty
                  const allEmpty = combined.every(
                    (m) =>
                      (!m.content || (typeof m.content === 'string' && m.content.trim() === '')) &&
                      (!m.toolCalls || m.toolCalls.length === 0)
                  );
                  if (allEmpty) return null;

                  // same user vs. asst approach as minimal tweak
                  const userParts = combined.filter((m) => m.role === 'user');
                  const asstParts = combined.filter((m) => m.role !== 'user');

                  return (
                    <div key={i} className="flex w-full flex-col gap-6">
                      {/* assistant */}
                      {asstParts.length > 0 && (
                        <div className="flex w-full flex-col">
                          <Tabs defaultValue={String(asstParts[0].rowIndex)}>
                            <div className="text-body mb-2 flex w-full items-center justify-start">
                              <TabsList className="justify-start">
                                {asstParts.map((m) => (
                                  <TabsTrigger key={m.rowIndex} value={String(m.rowIndex)}>
                                    Row {m.rowIndex}
                                  </TabsTrigger>
                                ))}
                              </TabsList>
                            </div>
                            {asstParts.map((m) => {
                              const label = formatRole(m.role);
                              const contentPath = [...path, 'choices', i, 'message', 'content']; // Path to content
                              const toolCallsPath = [...path, 'choices', i, 'message', 'toolCalls']; // Path to tool calls
                              return (
                                <TabsContent
                                  key={m.rowIndex}
                                  value={String(m.rowIndex)}
                                  className="w-full"
                                >
                                  <div className="w-full rounded border bg-background p-4 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-title">{label}</p>
                                      <CopyButton
                                        content={JSON.stringify(m.content)}
                                        copyMessage="Copied!"
                                      />
                                    </div>
                                    {/* Pass edit props */}
                                    {pickDataView(
                                      m.content,
                                      [],
                                      m.rowIndex,
                                      [],
                                      'none',
                                      false,
                                      displayMode,
                                      fieldName,
                                      context,
                                      baseLog,
                                      comparisonLogs,
                                      logsActions,
                                      cellEditMode,
                                      onSaveEdit,
                                      onGroupSaveEdit,
                                      isImmutable
                                    )}

                                    {m.toolCalls.length > 0 && (
                                      <div className="mt-2 border-l-2 pl-2">
                                        <p className="text-title mb-1">Tool Calls</p>
                                        <CopyButton
                                          className="mb-1"
                                          content={JSON.stringify(m.toolCalls, null, 2)}
                                          copyMessage="Copied!"
                                        />
                                        {/* Pass edit props */}
                                        {pickDataView(
                                          m.toolCalls,
                                          [],
                                          m.rowIndex,
                                          [],
                                          'none',
                                          false,
                                          displayMode,
                                          fieldName,
                                          context,
                                          baseLog,
                                          comparisonLogs,
                                          logsActions,
                                          cellEditMode,
                                          onSaveEdit,
                                          onGroupSaveEdit,
                                          isImmutable
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </TabsContent>
                              );
                            })}
                          </Tabs>
                        </div>
                      )}
                      {/* user */}
                      {userParts.length > 0 && (
                        <div className="flex w-full flex-col">
                          <Tabs defaultValue={String(userParts[0].rowIndex)}>
                            <div className="text-body mb-2 flex w-full items-center justify-between">
                              <TabsList className="justify-end">
                                {userParts.map((m) => (
                                  <TabsTrigger key={m.rowIndex} value={String(m.rowIndex)}>
                                    Row {m.rowIndex + 1}
                                  </TabsTrigger>
                                ))}
                              </TabsList>
                            </div>
                            {userParts.map((m) => {
                              const label = formatRole(m.role);
                              const contentPath = [...path, 'choices', i, 'message', 'content'];
                              const toolCallsPath = [...path, 'choices', i, 'message', 'toolCalls'];
                              return (
                                <TabsContent
                                  key={m.rowIndex}
                                  value={String(m.rowIndex)}
                                  className="w-full"
                                >
                                  <div className="w-full rounded border bg-background p-4 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-title-bold">{label}</p>
                                      <CopyButton
                                        content={JSON.stringify(m.content)}
                                        copyMessage="Copied!"
                                      />
                                    </div>
                                    {/* Pass edit props */}
                                    {pickDataView(
                                      m.content,
                                      [],
                                      m.rowIndex,
                                      [],
                                      'none',
                                      false,
                                      displayMode,
                                      fieldName,
                                      context,
                                      baseLog,
                                      comparisonLogs,
                                      logsActions,
                                      cellEditMode,
                                      onSaveEdit,
                                      onGroupSaveEdit,
                                      isImmutable
                                    )}

                                    {m.toolCalls.length > 0 && (
                                      <div className="mt-2 border-l-2 pl-2">
                                        <p className="text-title-bold mb-1">Tool Calls</p>
                                        <CopyButton
                                          className="mb-1"
                                          content={JSON.stringify(m.toolCalls, null, 2)}
                                          copyMessage="Copied!"
                                        />
                                        {/* Pass edit props */}
                                        {pickDataView(
                                          m.toolCalls,
                                          [],
                                          m.rowIndex,
                                          [],
                                          'none',
                                          false,
                                          displayMode,
                                          fieldName,
                                          context,
                                          baseLog,
                                          comparisonLogs,
                                          logsActions,
                                          cellEditMode,
                                          onSaveEdit,
                                          onGroupSaveEdit,
                                          isImmutable
                                        )}
                                      </div>
                                    )}
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
            <AccordionTrigger className="group relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <Component className="h-4 w-4 text-primary" />
                <span>Model</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="ml-4 border-l pl-1">
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
                  onGroupSaveEdit={onGroupSaveEdit} // Pass group save
                  path={[...path, 'model']} // Path to model
                />
              </div>
            </AccordionContent>
          </AccordionItem>
          {usageBase !== undefined && (
            <AccordionItem value="usage">
              <AccordionTrigger className="group relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-primary" />
                  <span>Usage</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4 border-l pl-1">
                  {pickDataView(
                    usageBase,
                    usageComps,
                    baseLogIndex,
                    comparisonLogsIndex,
                    diffMode,
                    splitView,
                    displayMode,
                    fieldName,
                    context,
                    baseLog,
                    comparisonLogs,
                    logsActions,
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
              <AccordionTrigger className="group relative flex items-center justify-between">
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span>Metadata</span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="ml-4 border-l pl-1">
                  {pickDataView(
                    leftover,
                    leftoverComparables,
                    baseLogIndex,
                    comparisonLogsIndex,
                    diffMode,
                    splitView,
                    displayMode,
                    fieldName,
                    context,
                    baseLog,
                    comparisonLogs,
                    logsActions,
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

  // diffMode !== "none" => side-by-side diffs
  return (
    <div className="space-y-4">
      <Accordion type="multiple" defaultValue={['chat']} className="space-y-2">
        <AccordionItem value="chat">
          <AccordionTrigger className="group relative flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span>Chat Output Comparison</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-6">
              {unified.map((block, i) => {
                const combined = gatherAll(block);
                if (!combined.length) return null;

                // Filter out blocks where all messages are empty
                const allEmpty = combined.every(
                  (m) =>
                    (!m.content || (typeof m.content === 'string' && m.content.trim() === '')) &&
                    (!m.toolCalls || m.toolCalls.length === 0)
                );
                if (allEmpty) return null;

                const roles = Array.from(new Set(combined.map((m) => m.role)));

                return (
                  <div key={i} className="space-y-4">
                    {roles.map((role) => {
                      const roleMsgs = combined.filter((r) => r.role === role);
                      if (!roleMsgs.length) return null;

                      const baseMsg = roleMsgs.find((r) => r.isBase);
                      const compMsgs = roleMsgs.filter((r) => !r.isBase);
                      if (!baseMsg && compMsgs.length === 0) return null;

                      const baseStr = baseMsg ? JSON.stringify(baseMsg.content, null, 2) : '';
                      const baseToolJSON = baseMsg
                        ? JSON.stringify(baseMsg.toolCalls, null, 2)
                        : '';
                      const label = formatRole(role);

                      return (
                        <div
                          key={`${i}-${role}`}
                          className="rounded border border-muted bg-background p-4 shadow-sm"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-title">{label}</p>
                            <CopyButton content={baseStr} copyMessage="Copied!" />
                          </div>

                          {/* content diffs */}
                          {compMsgs.length > 0 ? (
                            compMsgs.map((cm, idx2) => {
                              const cStr = JSON.stringify(cm.content, null, 2);
                              const same = cStr === baseStr;
                              const baseMode = same ? 'none' : 'delete';
                              const compMode = same ? 'none' : 'insert';
                              return (
                                <div
                                  key={idx2}
                                  className="text-caption relative mt-4 space-y-2 rounded border border-muted bg-background p-2"
                                >
                                  <div className="text-xxs flex gap-2">
                                    {baseMsg && (
                                      <RowBadge rowNumbers={[baseMsg.rowIndex]} mode={baseMode} />
                                    )}
                                    <RowBadge rowNumbers={[cm.rowIndex]} mode={compMode} />
                                  </div>
                                  <DiffViewer
                                    oldValue={baseStr}
                                    newValue={cStr}
                                    splitView={splitView}
                                    hideLineNumbers={
                                      !baseStr.includes('\n') && !cStr.includes('\n')
                                    }
                                    mode={diffMode}
                                  />
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-caption relative mt-4 space-y-2 rounded border border-muted bg-background p-2">
                              <div className="text-xxs flex gap-2">
                                {baseMsg && (
                                  <RowBadge rowNumbers={[baseMsg.rowIndex]} mode="delete" />
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

                          {/* tool call diffs */}
                          {(() => {
                            const hasBaseTools =
                              baseMsg && baseMsg.toolCalls && baseMsg.toolCalls.length > 0;
                            const anyCompTools = compMsgs.some(
                              (c) => c.toolCalls && c.toolCalls.length > 0
                            );
                            if (hasBaseTools || anyCompTools) {
                              return (
                                <div className="mt-6 space-y-2 border-t border-muted pt-2">
                                  <p className="text-title">Tool Calls Diff</p>
                                  {compMsgs.length > 0 ? (
                                    compMsgs.map((cm, idx3) => {
                                      const cTools = JSON.stringify(cm.toolCalls, null, 2);
                                      const sameTools = cTools === baseToolJSON;
                                      const baseBadge = sameTools ? 'none' : 'delete';
                                      const compBadge = sameTools ? 'none' : 'insert';
                                      return (
                                        <div
                                          key={idx3}
                                          className="text-caption relative space-y-2 rounded bg-background p-2"
                                        >
                                          <div className="text-xxs flex gap-2">
                                            {baseMsg && (
                                              <RowBadge
                                                rowNumbers={[baseMsg.rowIndex]}
                                                mode={baseBadge}
                                              />
                                            )}
                                            <RowBadge rowNumbers={[cm.rowIndex]} mode={compBadge} />
                                          </div>
                                          <DiffViewer
                                            oldValue={baseToolJSON}
                                            newValue={cTools}
                                            splitView={splitView}
                                            hideLineNumbers={
                                              !baseToolJSON.includes('\n') && !cTools.includes('\n')
                                            }
                                            mode={diffMode}
                                          />
                                        </div>
                                      );
                                    })
                                  ) : (
                                    <div className="text-caption relative space-y-2 rounded bg-background p-2">
                                      <div className="text-xxs flex gap-2">
                                        {baseMsg && (
                                          <RowBadge rowNumbers={[baseMsg.rowIndex]} mode="delete" />
                                        )}
                                        <RowBadge rowNumbers={[-1]} mode="insert" />
                                      </div>
                                      <DiffViewer
                                        oldValue={baseToolJSON}
                                        newValue=""
                                        splitView={splitView}
                                        hideLineNumbers={!baseToolJSON.includes('\n')}
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
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="model">
          <AccordionTrigger className="group relative flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <Component className="h-4 w-4 text-primary" />
              <span>Model</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="ml-4 border-l pl-1">
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
        {usageBase !== undefined && (
          <AccordionItem value="usage">
            <AccordionTrigger className="group relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary" />
                <span>Usage</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="ml-4 border-l pl-1">
                {pickDataView(
                  usageBase,
                  usageComps,
                  baseLogIndex,
                  comparisonLogsIndex,
                  diffMode,
                  splitView,
                  displayMode,
                  fieldName,
                  context,
                  baseLog,
                  comparisonLogs,
                  logsActions,
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
            <AccordionTrigger className="group relative flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span>Metadata</span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <div className="ml-4 border-l pl-1">
                {pickDataView(
                  leftover,
                  leftoverComparables,
                  baseLogIndex,
                  comparisonLogsIndex,
                  diffMode,
                  splitView,
                  displayMode,
                  fieldName,
                  context,
                  baseLog,
                  comparisonLogs,
                  logsActions,
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
