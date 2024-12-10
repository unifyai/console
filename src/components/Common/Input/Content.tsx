"use client";

import { ReactNode, InputHTMLAttributes, forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { Input as BaseInput } from "@/components/UI/input";

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  StartContent?: ReactNode;
  EndContent?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, StartContent, EndContent, ...props }, ref) => {

    return (
      <div className='
        w-fit flex flex-row gap-2 items-center
        bg-background rounded-md border border-input
        bg-background ring-offset-background
        px-2 py-1
      '>
        {StartContent}
        <BaseInput
          type={type}
          className={cn(`flex flex-1 overflow-s-scroll border-0 h-7`, className)}
          ref={ref}
          {...props}
        />
        <div className="justify-end">{EndContent}</div>
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };