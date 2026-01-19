'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import HallowButton from './hallowButton';
import loginImage1 from '@/public/icons/login-1.png';
import loginImage2 from '@/public/icons/login-2.png';
import loginImage3 from '@/public/icons/login-3.png';
import GoogleIcon from '@/public/icons/google-icon.png';
import GithubIcon from '@/public/icons/github-icon.png';
import { PhoneCall, ClipboardList, LayoutDashboard } from 'lucide-react';

interface LoginProps {
  // eslint-disable-next-line no-unused-vars
  onLogin: (provider: 'email' | 'google' | 'github', email?: string) => () => void;
  error?: string;
}

const LoginFragment = ({ onLogin: handleLogin, error }: LoginProps) => {
  const [email, setEmail] = useState<string>('');

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleLogin('email', email)();
  };

  return (
    <div className="flex flex-wrap gap-16">
      <div className="flex flex-1 flex-col gap-[40px]">
        <h1 className="text-center text-4xl leading-tight text-gray-800 sm:text-5xl lg:text-left">
          Hire <span className="font-bold">AIs</span>
          <br />
          not <span className="font-bold">APIs</span>
        </h1>
        <div className="flex flex-col gap-3">
          <div className="text-red-500">{error}</div>
          <HallowButton onClick={handleLogin('google')}>
            <div className="flex items-center justify-center gap-2">
              <Image src={GoogleIcon} alt="Google" height={20} width={20} />
              Continue with Google
            </div>
          </HallowButton>
          <HallowButton onClick={handleLogin('github')}>
            <div className="flex items-center justify-center gap-2">
              <Image src={GithubIcon} alt="Github" height={20} width={20} />
              Continue with Github
            </div>
          </HallowButton>
          <div className="text-branding-grey text-sm">
            {'By signing up you agree to our '}
            <a href="https://unify.ai/privacy-policy" className="font-semibold">
              Privacy Policy
            </a>
            {' and '}
            <a href="https://unify.ai/terms-of-service" className="font-semibold">
              Terms Of Service
            </a>
            {
              '. You may also receive communication on product updates and events, which you can edit in your profile.'
            }
          </div>
        </div>
      </div>
      <div className="hidden w-[1px] bg-[#DADADA] lg:block" />
      <div className="flex flex-col gap-[60px] text-xl lg:flex-[2]">
        <div className="text-branding-grey">Your Unify account lets you:</div>
        <div className="flex flex-col gap-[40px]">
          <div className="flex gap-[30px] font-medium">
            <PhoneCall className="h-fit text-green-500" />
            <p>
              <span className="font-bold">Call</span> your assistant to handle any task for you
            </p>
          </div>
          <div className="flex gap-[30px] font-medium">
            <ClipboardList className="h-fit text-green-500" />
            <p>
              <span className="font-bold">Delegate.</span> Let your assistant pick up calls, emails
              and messages.
            </p>
          </div>
          <div className="flex gap-[30px] font-medium">
            <LayoutDashboard className="h-fit text-green-500" />
            <p>
              <span className="font-bold">Iterate</span> with flexible interfaces to tweak your
              assistant.
            </p>
          </div>
        </div>
        <div className="text-right">
          {'Got any questions? Contact us at '}
          <a
            href="mailto:hello@unify.ai"
            className="bg-gradient-to-br from-[#0A0C13] to-[#00B828] bg-clip-text font-semibold text-transparent"
          >
            hello@unify.ai
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginFragment;
