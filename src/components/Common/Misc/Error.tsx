'use client';

import React from 'react';
import Image from 'next/image';
import ErrorImage from '@/public/images/404.png';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mt-32 flex justify-center">
      <div className="flex max-w-xl flex-col items-center gap-2 text-center">
        <Image src={ErrorImage} className="max-w-xl" alt="Unify Logo" />
        <h1 className="text-h1 text-strong">Something went wrong</h1>
        <p className="text-body">{"It's not your fault"}</p>
        <p className="text-body-dense text-muted-foreground">{error.message}</p>
        <p className="text-body-dense text-muted-foreground">
          {'Feel free to contact us and provide the following error digest: '}
          {error.digest}
        </p>
        <button
          onClick={reset}
          className="text-label mt-4 rounded-md bg-accent p-2 uppercase text-accent-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
