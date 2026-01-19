import { motion } from 'framer-motion';
import React, { useRef } from 'react';
import { useMeasure } from '@/utils/landingNav/useMeasure';
import styled from 'styled-components';

const Container = styled(motion.div)`
  overflow: hidden;
`;

interface AnimateHeightProps {
  duration?: number;
  ease?: string;
  variants?: {
    open: object;
    collapsed: object;
  };
  isVisible: boolean;
  children: any;
  className?: string;
}

export function AnimateHeight({
  duration,
  ease = 'easeOut',
  variants = {
    open: {
      opacity: 1,
      height: 'auto',
    },
    collapsed: { opacity: 0, height: 0 },
  },
  isVisible,
  children,
  ...other
}: AnimateHeightProps) {
  const ref = useRef(null);
  const bounds = useMeasure(ref);

  return (
    <Container
      initial={isVisible ? 'open' : 'collapsed'}
      animate={isVisible ? 'open' : 'collapsed'}
      inherit={false}
      variants={{
        open: { ...variants.open, height: bounds?.height ?? 'auto' },
        collapsed: { ...variants.collapsed, height: 0 },
      }}
      transition={{
        ease,
        duration,
      }}
      {...other}
    >
      {typeof children === 'function' ? children(ref) : <div ref={ref}>{children}</div>}
    </Container>
  );
}
