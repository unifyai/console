import { ButtonHTMLAttributes, DetailedHTMLProps } from 'react';

const HallowButton = (
  params: DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement>
) => {
  return (
    <button
      {...params}
      className="w-full rounded-[10px] bg-gradient-to-r from-[var(--brand-green-light)] to-[var(--brand-green)] p-0.5"
    >
      <div className="rounded-[8px] bg-background">
        <div className="whitespace-nowrap bg-gradient-to-r from-[var(--brand-green-light)] to-[var(--brand-green)] bg-clip-text px-6 py-3 font-bold uppercase text-transparent">
          {params.children}
        </div>
      </div>
    </button>
  );
};

export default HallowButton;
