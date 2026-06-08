import { cn } from '@/lib/utils';

type UnifyBlockMarkProps = {
  className?: string;
  showWordmark?: boolean;
};

export function UnifyBlockMark({ className, showWordmark = false }: UnifyBlockMarkProps) {
  return (
    <span
      className={cn('unify-block-mark inline-flex items-center gap-2 text-foreground', className)}
    >
      <svg
        aria-hidden="true"
        className="glyph h-6 w-6 overflow-visible"
        role="img"
        viewBox="0 0 31 31"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g className="lg lg-green">
          <rect fill="var(--role-green)" height="7.6" rx="2.4" width="7.6" x="1.5" y="1.5" />
          <rect fill="var(--role-green)" height="7.6" rx="2.4" width="7.6" x="10.5" y="1.5" />
          <rect fill="var(--role-green)" height="7.6" rx="2.4" width="7.6" x="1.5" y="10.5" />
        </g>
        <g className="lg lg-blue">
          <rect fill="var(--role-blue)" height="7.6" rx="2.4" width="7.6" x="19.5" y="1.5" />
          <rect fill="var(--role-blue)" height="7.6" rx="2.4" width="7.6" x="10.5" y="10.5" />
          <rect fill="var(--role-blue)" height="7.6" rx="2.4" width="7.6" x="19.5" y="10.5" />
        </g>
        <g className="lg lg-orange">
          <rect fill="var(--role-orange)" height="7.6" rx="2.4" width="7.6" x="1.5" y="19.5" />
          <rect fill="var(--role-orange)" height="7.6" rx="2.4" width="7.6" x="10.5" y="19.5" />
          <rect fill="var(--role-orange)" height="7.6" rx="2.4" width="7.6" x="19.5" y="19.5" />
        </g>
      </svg>
      {showWordmark ? (
        <span className="text-title text-semibold tracking-[-0.02em]">Unify</span>
      ) : null}
    </span>
  );
}
