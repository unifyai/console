'use client';

import * as React from 'react';
import { Check, Code2, Link2 } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { cn } from '@/lib/utils';
import { useCopyToClipboard } from '@/hooks/Common/useCopyToClipboard';
import { AssistantMarkdown, fencedCode } from '../Common/AssistantMarkdown';
import { DetailSection } from '../Common/DetailSection';
import { StaleReasonChips } from '../Common/StaleReasonChips';
import { FunctionSignatureDocs } from './FunctionSignatureDocs';
import type { FunctionEntry } from '@/utils/assistants/functions';

/**
 * A function's detail view, as its own page shows it.
 *
 * Extracted from FunctionsPane so the Workflows drawer can preview a bundled
 * function by rendering *this*, not an imitation of it. A second description of
 * the same artifact is a second thing to keep in step, and it would not stay in
 * step — which is the whole reason these live here now.
 */

export function KindBadge({ isPrimitive }: { isPrimitive: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-[7px] py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.04em]',
        isPrimitive
          ? 'bg-[color-mix(in_srgb,var(--role-purple)_14%,transparent)] text-[color:var(--role-purple)]'
          : 'bg-[color:var(--status-success-bg)] text-[color:var(--status-success)]'
      )}
    >
      {isPrimitive ? 'primitive' : 'learned'}
    </span>
  );
}

export function FunctionBadges({ fn }: { fn: FunctionEntry }) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="function-badges">
      <KindBadge isPrimitive={fn.isPrimitive} />
      {fn.verify && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--status-success-bg)] px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--status-success)]">
          <Check className="h-3 w-3" /> verified
        </span>
      )}
    </div>
  );
}

export function FunctionDetailBody({ fn }: { fn: FunctionEntry }) {
  return (
    <div className="space-y-4 pr-4" data-testid="function-detail-body">
      {fn.staleReasons.length > 0 && (
        <StaleReasonChips
          reasons={fn.staleReasons}
          banner
          chipTestIdPrefix="function-stale-reason"
        />
      )}

      <FunctionSignatureDocs argspec={fn.argspec} docstring={fn.docstring} language={fn.language} />

      {fn.dependsOn.length > 0 && (
        <DetailSection label="Depends on" variant="field">
          <div className="flex flex-wrap gap-1.5">
            {fn.dependsOn.map((dep) => (
              <span
                key={dep}
                className="bg-muted/40 text-code-sm rounded-md border px-2 py-0.5 text-muted-foreground"
              >
                {dep}
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {fn.guidanceIds.length > 0 && (
        <DetailSection label="Linked guidance" variant="field">
          <div className="flex flex-wrap gap-1.5">
            {fn.guidanceIds.map((guidanceId) => (
              <span
                key={guidanceId}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-medium text-accent-soft-foreground"
                data-testid={`function-guidance-chip-${guidanceId}`}
              >
                <Link2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="font-mono">guidance #{guidanceId}</span>
              </span>
            ))}
          </div>
        </DetailSection>
      )}

      {fn.precondition && (
        <DetailSection label="Precondition" variant="field">
          <AssistantMarkdown>
            {fencedCode(JSON.stringify(fn.precondition, null, 2), 'json')}
          </AssistantMarkdown>
        </DetailSection>
      )}

      <DetailSection label="Implementation" variant="field">
        {fn.implementation ? (
          <AssistantMarkdown>{fencedCode(fn.implementation, fn.language)}</AssistantMarkdown>
        ) : (
          <p className="text-caption">
            This is a primitive — its implementation lives in the platform&apos;s state-manager
            class, not as stored source.
          </p>
        )}
      </DetailSection>
    </div>
  );
}

export function CopySignatureButton({ fn }: { fn: FunctionEntry }) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: fn.implementation || fn.argspec,
    copyMessage: 'Copied',
    showSuccessNotification: false,
  });
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} data-testid="function-copy">
      {isCopied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Code2 className="mr-1 h-3.5 w-3.5" />}
      {isCopied ? 'Copied' : 'Copy'}
    </Button>
  );
}
