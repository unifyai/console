'use client';

import Image from 'next/image';
import UnifyLogo from '@/public/ivy_logo_only.png';

const CheckElement = () => {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10">
      <Image src={UnifyLogo} alt="Unify" height={150} width={150} />
      <h2 className="text-center text-xl font-medium">
        Check your email for the verification link
      </h2>
      <p>We have sent you a sign in link, use it to log in.</p>
    </div>
  );
};

export default CheckElement;
