import { Button } from '@/components/UI/button';
import { ReactNode } from 'react';
import { MouseEventHandler, KeyboardEventHandler } from 'react';
export default function BaseButton({
  text,
  icon,
  variant,
  disabled = false,
  type,
  size = 'sm',
  onClick,
  className,
  onKeyDown,
}: {
  text?: string;
  variant?:
    | 'default'
    | 'primary'
    | 'secondary'
    | 'destructive'
    | 'warning'
    | 'warningOutline'
    | 'outline'
    | 'ghost'
    | 'link';
  icon?: ReactNode;
  disabled?: boolean;
  type?: 'submit' | 'reset' | 'button' | undefined;
  size?: 'icon' | 'default' | 'sm' | 'lg' | null | undefined;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
  onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
}) {
  return (
    <Button
      disabled={disabled}
      variant={variant}
      size={size}
      type={type}
      onClick={onClick}
      className={className}
      onKeyDown={onKeyDown}
    >
      {icon} {text}
    </Button>
  );
}
