import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2 } from 'lucide-react';
import { FreshnessClass } from '../types/freshness';

export interface ClassificationToastState {
  id: number;
  classification: FreshnessClass;
}

const TOAST_MESSAGE: Record<FreshnessClass, string> = {
  fresh: 'Saved as Fresh',
  'semi-fresh': 'Saved as Semi-Fresh',
  spoiled: 'Saved as Spoiled',
};

const TOAST_STYLE: Record<FreshnessClass, string> = {
  fresh: 'border-emerald-200 bg-white text-emerald-800',
  'semi-fresh': 'border-amber-200 bg-white text-amber-800',
  spoiled: 'border-rose-200 bg-white text-rose-800',
};

interface ClassificationToastProps {
  toast: ClassificationToastState | null;
}

export const ClassificationToast: React.FC<ClassificationToastProps> = ({ toast }) => {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(0.75rem,env(safe-area-inset-top))]"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className={`flex max-w-sm items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold shadow-md ${TOAST_STYLE[toast.classification]}`}
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
            <span>{TOAST_MESSAGE[toast.classification]}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
