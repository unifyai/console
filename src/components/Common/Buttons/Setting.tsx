import { ReactNode, forwardRef, ForwardedRef } from 'react';
import Tooltip from '../Misc/Tooltip';
import { MouseEventHandler } from 'react';
import { Button } from '@/components/UI/button';

interface SettingButtonProps {
  tooltip: string;
  disabled?: boolean;
  icon: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  text?: string;
  variant?: 'default' | 'primary' | 'secondary' | 'destructive' | 'outline' | 'ghost' | 'link';
}

const SettingButton = forwardRef<HTMLButtonElement, SettingButtonProps>(
  (
    { tooltip, disabled = false, icon, onClick, text, variant = 'outline' },
    ref: ForwardedRef<HTMLButtonElement>
  ) => {
    return (
      <Tooltip content={tooltip}>
        <Button
          ref={ref}
          variant={variant}
          size="sm"
          type="button"
          disabled={disabled}
          onClick={onClick}
        >
          {icon} {text}
        </Button>
      </Tooltip>
    );
  }
);

SettingButton.displayName = 'SettingButton';

export default SettingButton;
