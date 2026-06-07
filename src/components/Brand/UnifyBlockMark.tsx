import { cn } from '@/lib/utils';

type UnifyBlockMarkProps = {
  className?: string;
  showWordmark?: boolean;
};

export function UnifyBlockMark({ className, showWordmark = false }: UnifyBlockMarkProps) {
  return (
    <span className={cn('group inline-flex items-center gap-2 text-foreground', className)}>
      <svg
        aria-hidden="true"
        className="h-6 w-6 overflow-visible"
        role="img"
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g className="origin-center transition-transform duration-300 ease-out group-hover:-translate-x-0.5 group-hover:-translate-y-0.5">
          <rect fill="var(--role-green)" height="12" rx="3" width="12" x="2" y="2" />
          <rect fill="var(--role-green)" height="12" rx="3" width="12" x="2" y="18" />
        </g>
        <g className="origin-center transition-transform duration-300 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
          <rect fill="var(--role-blue)" height="12" rx="3" width="12" x="18" y="2" />
        </g>
        <g className="origin-center transition-transform duration-300 ease-out group-hover:translate-y-0.5">
          <rect fill="var(--role-orange)" height="12" rx="3" width="12" x="18" y="18" />
        </g>
      </svg>
      {showWordmark ? (
        <span className="text-title text-semibold tracking-[-0.02em]">Unify</span>
      ) : null}
    </span>
  );
}
