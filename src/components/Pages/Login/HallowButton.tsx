import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react';
import { cn } from '@/lib/utils';

const HallowButton = (
  params: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>
) => {
  return (
    <button
      {...params}
      className={cn(
        'w-full rounded-lg bg-primary text-primary-foreground shadow-[0_2px_0_var(--role-green-deep)] transition-all hover:-translate-y-px hover:shadow-[0_4px_0_var(--role-green-deep)]',
        params.className
      )}
    >
      <div className="whitespace-nowrap px-6 py-3 font-semibold">{params.children}</div>
    </button>
  );
};

export default HallowButton;
