import { ForwardedRef, ReactNode, forwardRef } from 'react';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { MouseEventHandler } from 'react';
import { Button } from '@/components/UI/button';

type ActionButtonProps = {
  tooltip: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  text?: string;
  icon?: ReactNode;
  size?: 'icon' | 'default' | 'sm' | 'lg' | null | undefined;
  variant?:
    | 'primary'
    | 'secondary'
    | 'destructive'
    | 'warning'
    | 'warningOutline'
    | 'outline'
    | 'ghost'
    | 'link';
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  className?: string;
};

const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(function ActionButton(
  {
    tooltip,
    text,
    icon,
    size = 'sm',
    variant = 'ghost',
    side = 'top',
    disabled,
    onClick,
    className,
  },
  ref: ForwardedRef<HTMLButtonElement>
) {
  return (
    <Tooltip content={tooltip} side={side}>
      <Button
        ref={ref}
        variant={variant}
        size={size}
        disabled={disabled}
        onClick={onClick}
        className={className}
      >
        {icon} {text}
      </Button>
    </Tooltip>
  );
});

ActionButton.displayName = 'ActionButton';

export default ActionButton;
