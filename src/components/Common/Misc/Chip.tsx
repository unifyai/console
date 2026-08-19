import { Badge } from '@/components/UI/badge';
import { ReactNode } from 'react';

export default function Chip({
  text,
  button,
  variant = 'default',
  className,
}: {
  text?: string;
  button?: ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline';
  className?: string;
}) {
  return (
    <Badge variant={variant} className={'flex flex-row items-center gap-1 rounded-lg'}>
      {text}
      {button}
    </Badge>
  );
}
