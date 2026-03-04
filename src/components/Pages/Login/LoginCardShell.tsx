'use client';

import { motion } from 'framer-motion';

/**
 * Shared card shell for all `/login/*` pages.
 *
 * Provides:
 * - Full-viewport background via `fixed inset-0` (no 100vh rounding issues)
 * - Spring-from-bottom entrance animation (plays once when the layout mounts)
 * - Floating card with border + drop-shadow at xl breakpoint
 * - Scrollable card container with responsive padding
 *
 * Structure (simplified):
 *   fixed backdrop (bg-background, covers viewport)
 *   └─ motion.div (viewport-height, transparent, handles animation + centering)
 *       └─ card div (full-screen on mobile, floating 720px card at xl)
 *
 * The motion.div covers the entire viewport and is always transparent —
 * there is no intermediate visual layer that could create a gap between
 * the backdrop and the card.
 */
const LoginCardShell = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="fixed inset-0 bg-background">
      <motion.div
        initial={{ y: '100vh' }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', bounce: 0.1 }}
        className="z-[200] flex h-full items-center justify-center"
      >
        <div className="flex h-full w-full overflow-y-auto bg-background p-8 md:p-24 xl:h-auto xl:max-h-screen xl:w-[720px] xl:rounded-xl xl:drop-shadow-[0px_12px_100px_rgba(0,184,40,0.18)]">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default LoginCardShell;
