import {
  Tooltip as TooltipMenu,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/UI/tooltip';
import { ReactNode } from 'react';

export default function Tooltip({
  children,
  content,
  side,
}: {
  children: ReactNode;
  content: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <TooltipProvider>
      <TooltipMenu>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>
          <p>{content}</p>
        </TooltipContent>
      </TooltipMenu>
    </TooltipProvider>
  );
}
