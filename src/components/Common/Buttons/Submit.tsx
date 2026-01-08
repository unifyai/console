import { ReactNode } from 'react';
import BaseButton from './Base';
import { LoaderCircle } from 'lucide-react';

export default function SubmitButton({
  text = 'Submit',
  icon,
  disabled = false,
  onClick,
  loading,
  className,
  variant,
}: {
  text?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  loading?: boolean;
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost';
}) {
  return (
    <BaseButton
      variant={variant}
      text={text}
      disabled={disabled || loading}
      type="submit"
      onClick={onClick}
      icon={
        loading ? (
          <LoaderCircle className={`${className} animate-spin text-primary-foreground`} />
        ) : (
          icon
        )
      }
    />
  );
}
