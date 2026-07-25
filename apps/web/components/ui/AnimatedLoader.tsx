'use client';

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export function AnimatedLoader({
  steps,
  currentStep,
  className,
}: {
  steps: string[];
  currentStep: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div className="flex gap-2 mb-2">
        {steps.map((step, idx) => {
          const isActive = idx === currentStep;
          const isPast = idx < currentStep;
          return (
            <div key={step} className="flex flex-col items-center gap-1">
              <motion.div
                className={cn(
                  'w-8 h-2 rounded-full transition-colors duration-500',
                  isActive ? 'bg-[var(--color-brand-orange)]' : isPast ? 'bg-[var(--color-brand-light)] opacity-50' : 'bg-[var(--color-brand-border)] opacity-30'
                )}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
              />
            </div>
          );
        })}
      </div>
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        className="text-[var(--color-brand-orange)] font-medium"
      >
        {steps[currentStep]}...
      </motion.div>
    </div>
  );
}
