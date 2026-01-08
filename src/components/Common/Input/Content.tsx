'use client';

import { ReactNode, InputHTMLAttributes, forwardRef, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Input as BaseInput } from '@/components/UI/input';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  StartContent?: ReactNode;
  EndContent?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, StartContent, EndContent, ...props }, ref) => {
    return (
      <div className="flex w-fit flex-row items-center gap-2 rounded-md border border-input bg-background px-2 py-1 ring-offset-background">
        {StartContent}
        <BaseInput
          type={type}
          className={cn(`overflow-s-scroll flex h-7 flex-1 border-0`, className)}
          ref={ref}
          {...props}
        />
        <div className="justify-end">{EndContent}</div>
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
