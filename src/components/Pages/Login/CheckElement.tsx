'use client';

import { UnifyBlockMark } from '@/components/Brand';

const CheckElement = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10">
      <UnifyBlockMark className="scale-150" showWordmark />
      <h2 className="text-h1 text-center">Check your email for the verification link</h2>
      <p>We have sent you a sign in link, use it to log in.</p>
    </div>
  );
};

export default CheckElement;
