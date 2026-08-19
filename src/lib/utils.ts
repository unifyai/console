import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        'text-display',
        'text-h1',
        'text-h2',
        'text-h3',
        'text-h1-bold',
        'text-h2-bold',
        'text-h3-bold',
        'text-title',
        'text-title-bold',
        'text-subtitle',
        'text-body',
        'text-body-dense',
        'text-body-sm',
        'text-body-muted',
        'text-body-lg-muted',
        'text-caption',
        'text-caption-sm',
        'text-label',
        'text-label-muted',
        'text-data',
        'text-data-header',
        'text-overline',
        'text-base-static',
      ],
      'text-color': ['text-error', 'text-success', 'text-warning', 'text-muted', 'text-link'],
      'font-weight': ['text-strong', 'text-semibold', 'text-bold'],
      'font-family': ['text-mono'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
