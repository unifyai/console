'use client';

import { parseFunctionDocstring } from '@/utils/assistants/functionDoc';
import { AssistantMarkdown, fencedCode } from '../Common/AssistantMarkdown';

function ParamTable({ params }: { params: ReturnType<typeof parseFunctionDocstring>['params'] }) {
  if (params.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="text-body-dense w-full">
        <thead>
          <tr className="bg-muted/30 border-b border-border">
            <th className="text-overline px-3 py-2 text-left">Parameter</th>
            <th className="text-overline px-3 py-2 text-left">Type</th>
            <th className="text-overline px-3 py-2 text-left">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param) => (
            <tr key={param.name} className="border-t border-border align-top">
              <td className="text-code-sm px-3 py-2 font-medium text-foreground">{param.name}</td>
              <td className="text-code-sm px-3 py-2 text-muted-foreground">{param.type || '—'}</td>
              <td className="px-3 py-2 text-[12px] leading-relaxed text-foreground">
                {param.description || '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FunctionSignatureDocs({
  argspec,
  docstring,
  language,
}: {
  argspec: string;
  docstring: string;
  language: string;
}) {
  const parsed = parseFunctionDocstring(docstring);

  return (
    <div className="space-y-4">
      {argspec && (
        <div className="space-y-1.5">
          <div className="text-overline">Signature</div>
          <AssistantMarkdown>{fencedCode(argspec, language)}</AssistantMarkdown>
        </div>
      )}

      {parsed.summary && (
        <div className="space-y-1.5">
          <div className="text-overline">Summary</div>
          <p className="text-[12.5px] leading-relaxed text-foreground">{parsed.summary}</p>
        </div>
      )}

      {parsed.params.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-overline">Parameters</div>
          <ParamTable params={parsed.params} />
        </div>
      )}

      {parsed.returns && (
        <div className="space-y-1.5">
          <div className="text-overline">Returns</div>
          <div className="bg-muted/20 overflow-hidden rounded-lg border border-border px-3 py-2.5">
            {parsed.returns.type && (
              <span className="text-code-sm mr-2 font-medium text-primary">
                {parsed.returns.type}
              </span>
            )}
            <span className="text-[12px] leading-relaxed text-foreground">
              {parsed.returns.description}
            </span>
          </div>
        </div>
      )}

      {!parsed.summary && !parsed.params.length && !parsed.returns && docstring && (
        <AssistantMarkdown>{docstring}</AssistantMarkdown>
      )}
    </div>
  );
}
