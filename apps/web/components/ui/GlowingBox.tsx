'use client';

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { ReactNode } from 'react';

export function GlowingBox({
  children,
  className,
  isGlowing = false,
}: {
  children: ReactNode;
  className?: string;
  isGlowing?: boolean;
}) {
  return (
    <div className={cn('relative group rounded-3xl', className)}>
      <motion.div
        className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-[var(--color-brand-orange)] via-[var(--color-brand-light)] to-[var(--color-brand-orange)] opacity-0 blur-sm transition-opacity duration-500"
        animate={{ opacity: isGlowing ? 0.7 : 0 }}
        style={{ zIndex: -1 }}
      />
      <motion.div
        className="absolute -inset-[1px] rounded-3xl bg-gradient-to-r from-[var(--color-brand-orange)] via-[var(--color-brand-light)] to-[var(--color-brand-orange)] opacity-0 transition-opacity duration-500"
        animate={{ opacity: isGlowing ? 1 : 0 }}
        style={{ zIndex: -1 }}
      />
      <div className="relative bg-white rounded-3xl h-full w-full">
        {children}
      </div>
    </div>
  );
}
