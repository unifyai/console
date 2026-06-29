'use client';

import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { Info, Eye, EyeOff, Check } from 'lucide-react';
import * as React from 'react';

export function ApiKeyField({ apiKey }: { apiKey: string }) {
  const [isVisible, setIsVisible] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div>
      <div className="flex flex-row items-center gap-2 pb-1">
        <Label>API Key</Label>
        <TooltipProvider delayDuration={100}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-caption max-w-xs">
              <p>
                Used for programmatic integration, see{' '}
                <a
                  href="https://docs.unify.ai/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  docs
                </a>
                .
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            type="text"
            value={isVisible ? apiKey : '••••••••••••••••••••••••••••••••'}
            className="text-code cursor-pointer"
            readOnly
            onClick={handleCopy}
          />
          {isCopied && (
            <span className="text-caption absolute right-3 top-1/2 -translate-y-1/2 rounded bg-muted px-1.5 py-0.5 duration-150 animate-in fade-in">
              Copied!
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 flex-shrink-0"
          onClick={() => setIsVisible(!isVisible)}
        >
          {isCopied ? (
            <Check className="h-4 w-4 text-[color:var(--status-success)]" />
          ) : isVisible ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
