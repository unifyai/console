"use client"

import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCopyToClipboard } from "@/hooks/Chat/use-copy-to-clipboard"
import ActionButton from "@/components/Common/Buttons/Action"

type CopyButtonProps = {
  content: string
  copyMessage?: string
  tooltipContent?: string,
  className?: string
}

export function CopyButton({ content, copyMessage, tooltipContent, className }: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  })

  return (
    <ActionButton
      variant="ghost"
      tooltip={tooltipContent ?? "Copy"}
      className={`relative ${className}`}
      aria-label="Copy to clipboard"
      onClick={(e) => {
        e.stopPropagation()
        handleCopy()
      }}
      icon={
        <>
        <div className="absolute inset-0 flex items-center justify-center">
          <Check
            className={cn(
              "h-2 w-2 transition-transform ease-in-out",
              isCopied ? "scale-100" : "scale-0"
            )}
          />
        </div>
        <Copy
          className={cn(
            "h-2 w-2 transition-transform ease-in-out",
            isCopied ? "scale-0" : "scale-100"
          )}
        />
        </>
      }
    />
  )
}
