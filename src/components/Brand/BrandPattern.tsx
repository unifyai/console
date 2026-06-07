import { cn } from '@/lib/utils';

type BrandPatternProps = {
  children?: React.ReactNode;
  className?: string;
  variant?: 'grid' | 'checker';
};

export function BrandPattern({ children, className, variant = 'grid' }: BrandPatternProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        variant === 'grid' ? 'brand-pixel-grid' : 'brand-checkerboard',
        className
      )}
    >
      {children}
    </div>
  );
}
