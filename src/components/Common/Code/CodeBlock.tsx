'use client';

import Link from 'next/link';
import { Check, ExternalLink, Loader2, Play, Save } from 'lucide-react';
import ActionButton from '../Buttons/Action';
import { CopyButton } from '../Buttons/Copy';
import { Editor } from '@monaco-editor/react';
import { useState, useEffect } from 'react';
import { DoublePanels } from '../Body/DoublePanels';

const CodeBlock = ({
  code,
  output,
  language,
  externalLink,
  pending,
  complete,
  create,
  disabled,
  readOnly,
  setTempCode,
  onRun,
}: {
  code: string;
  output?: string;
  language: string | undefined;
  externalLink?: string;
  pending: boolean;
  complete?: boolean;
  create: string | null;
  disabled: boolean;
  readOnly?: boolean;
  setTempCode?: (code: string) => void;
  onRun: (code: string) => void;
}) => {
  return (
    <div className={`relative flex h-full w-full gap-3`}>
      <div className="absolute right-5 top-2 z-10">
        {externalLink && (
          <Link href={`https://docs.unify.ai/${externalLink}`} target="_blank">
            <ActionButton icon={<ExternalLink />} tooltip={'Learn more'} />
          </Link>
        )}
        <ActionButton
          icon={pending || create != null ? <Loader2 className="animate-spin" /> : <Play />}
          tooltip={'Run'}
          onClick={() => onRun(code)}
          disabled={disabled || pending}
        />
        <CopyButton content={code} copyMessage="Copied!" />
      </div>
      {readOnly || language != 'python' ? (
        <Editor
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            readOnly: readOnly,
            padding: {
              top: 24,
              bottom: 24,
            },
            fontSize: !readOnly ? 14 : undefined,
            scrollbar: {
              alwaysConsumeMouseWheel: false,
            },
          }}
          theme="vs-dark"
          language={language}
          value={code}
          onChange={(value) => setTempCode && setTempCode(value || '')}
        />
      ) : (
        <DoublePanels
          isLoading={false}
          direction="vertical"
          defaultSecondSize={5.3}
          first={
            <Editor
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                readOnly: readOnly,
                padding: {
                  top: 24,
                  bottom: 24,
                },
                fontSize: !readOnly ? 14 : undefined,
                scrollbar: {
                  alwaysConsumeMouseWheel: false,
                },
              }}
              theme="vs-dark"
              language={language}
              value={code}
              onChange={(value) => setTempCode && setTempCode(value || '')}
            />
          }
          second={
            <div className="flex h-full w-full flex-col gap-2 pt-2">
              <div className="flex items-center gap-4">
                <div className="text-label text-strong text-muted-foreground">Output</div>
                {pending && <Loader2 className="animate-spin" />}
                {complete && <Check />}
              </div>
              <div className="h-full w-full">
                <Editor
                  options={{
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    wordWrap: 'on',
                    lineNumbers: 'off',
                    readOnly: true,
                    padding: {
                      top: 12,
                      bottom: 12,
                    },
                    fontSize: 14,
                    renderLineHighlight: 'none',
                    hideCursorInOverviewRuler: true,
                    overviewRulerBorder: false,
                    overviewRulerLanes: 0,
                    scrollbar: {
                      alwaysConsumeMouseWheel: false,
                      vertical: 'hidden',
                      horizontal: 'hidden',
                      useShadows: false,
                      verticalScrollbarSize: 0,
                      horizontalScrollbarSize: 0,
                    },
                    glyphMargin: false,
                    folding: false,
                    lineDecorationsWidth: 20,
                    lineNumbersMinChars: 0,
                    guides: {
                      indentation: false,
                      highlightActiveIndentation: false,
                    },
                    cursorStyle: 'line-thin',
                    cursorBlinking: 'solid',
                  }}
                  theme="vs-dark"
                  value={output}
                />
              </div>
            </div>
          }
        />
      )}
    </div>
  );
};

export default CodeBlock;
