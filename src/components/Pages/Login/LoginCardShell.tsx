'use client';

import { motion } from 'framer-motion';

/**
 * Shared card shell for all `/login/*` pages.
 *
 * Provides:
 * - Full-screen centred background (solid on mobile, transparent on xl)
 * - Spring-from-bottom entrance animation (plays once when the layout mounts)
 * - Halo border + drop-shadow at xl breakpoint
 * - Scrollable card container with responsive padding
 *
 * Each page supplies only its **content** as `children`. The content is
 * wrapped in a `motion.div` that fades in, providing a smooth transition
 * when navigating between `/login`, `/login/invite`, and `/login/mfa`.
 *
 * Because Next.js preserves layouts across sibling routes, the card shell
 * stays mounted during navigation — only the inner content re-renders and
 * fades in, giving the impression of a seamless single-page flow.
 */
const LoginCardShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="fixed left-0 top-0 flex h-screen w-screen items-center justify-center bg-background xl:bg-transparent">
      <motion.div
        initial={{ y: '100vh' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', bounce: 0.1 }}
        className="z-[200] xl:border-1 xl:rounded-3xl xl:border-[var(--white-smoke)] xl:p-6 xl:backdrop-blur-lg"
      >
        <div className="flex h-screen w-screen overflow-y-auto bg-background p-8 md:p-24 xl:h-auto xl:max-h-screen xl:w-[720px] xl:rounded-lg xl:drop-shadow-[0px_12px_100px_rgba(0,184,40,0.18)]">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginCardShell;

