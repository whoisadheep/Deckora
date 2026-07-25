'use client';

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ReactNode } from 'react';

export function FadeUpText({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.8,
        delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
      className={cn('', className)}
    >
      {children}
    </motion.div>
  );
}
