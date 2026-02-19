'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import HallowButton from './hallowButton';
import loginImage1 from '@/public/icons/login-1.png';
import loginImage2 from '@/public/icons/login-2.png';
import loginImage3 from '@/public/icons/login-3.png';
import GoogleIcon from '@/public/icons/google-icon.png';
import GithubIcon from '@/public/icons/github-icon.png';
import { PhoneCall, ClipboardList, LayoutDashboard, User } from 'lucide-react';

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
        <h1 className="text-center text-4xl leading-tight text-gray-800 dark:text-white sm:text-5xl lg:text-left">
          Hire <span className="font-bold">AI</span>
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
          <div className="text-branding-grey text-body">
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
      <div className="hidden w-[1px] bg-[var(--border-light)] lg:block" />
      <div className="flex flex-col gap-[60px] text-xl lg:flex-[2]">
        <div className="text-branding-grey"></div>
        <div className="flex flex-col gap-[40px]">
          <div className="flex gap-[30px] font-medium items-center">
            <User className="h-fit text-green-500" />
            <p>
            <span className="font-bold">Hire</span> personal assistants to handle your work.
            </p>
          </div>
          <div className="flex gap-[30px] font-medium items-center">
            <ClipboardList className="h-fit text-green-500" />
            <p>
            <span className="font-bold">Delegate</span> tasks naturally via call, email or message.
            </p>
          </div>
          <div className="flex gap-[30px] font-medium items-center">
            <LayoutDashboard className="h-fit text-green-500" />
            <p>
            <span className="font-bold">Monitor</span> progress and provide feedback in real time.
            </p>
          </div>
        </div>
        <div className="text-right text-body pt-10">
          {'Contact us at '}
          <a
            href="mailto:hello@unify.ai"
            className="bg-gradient-to-br from-[var(--near-black)] to-[var(--brand-green)] bg-clip-text font-semibold text-transparent"
          >
            hello@unify.ai
          </a>
        </div>
      </div>
    </div>
  );
};

export default LoginFragment;
