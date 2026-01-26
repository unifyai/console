import React from 'react';
import Image from 'next/image';
import ErrorImage from '@/public/images/404.png';
import Scaffold from '@/components/Layout/LandingNav/Scaffold';

export default function Error() {
  return (
    <Scaffold>
      <div className="mt-32 flex justify-center">
        <div className="flex max-w-xl flex-col items-center gap-2">
          <Image src={ErrorImage} className="max-w-xl" alt="Unify Logo" />
          <h1 className="text-h1 text-semibold">{"Couldn't find what you want"}</h1>
          <p>{"It's not your fault"}</p>
          <p className="font-light">Make sure the URL is correct, we think something is wrong.</p>
        </div>
      </div>
    </Scaffold>
  );
}
