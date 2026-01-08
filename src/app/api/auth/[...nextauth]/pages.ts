import { NextAuthOptions } from 'next-auth';

export const authOptions: Partial<NextAuthOptions> = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
};

export default authOptions;
