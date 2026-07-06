'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const statusBorder = (token: string) =>
  `group-[.toaster]:border-[color:color-mix(in_srgb,var(${token})_25%,var(--border))]` as const;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast group-[.toaster]:shadow-lg min-w-[380px]',
          default:
            'group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border',
          loading:
            'group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border',
          title: 'text-strong',
          description: 'text-body opacity-90',
          success: `group-[.toaster]:bg-[color:var(--status-success-bg)] group-[.toaster]:text-[color:var(--status-success)] ${statusBorder('--status-success')}`,
          error: `group-[.toaster]:bg-[color:var(--status-danger-bg)] group-[.toaster]:text-[color:var(--status-danger)] ${statusBorder('--status-danger')}`,
          info: `group-[.toaster]:bg-[color:var(--status-info-bg)] group-[.toaster]:text-[color:var(--status-info)] ${statusBorder('--status-info')}`,
          warning: `group-[.toaster]:bg-[color:var(--status-warning-bg)] group-[.toaster]:text-[color:var(--status-warning)] ${statusBorder('--status-warning')}`,
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
