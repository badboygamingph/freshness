import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Leaf, AlertTriangle, Sparkles } from 'lucide-react';
import { FreshnessClass } from '../types/freshness';

export interface ClassificationToastState {
  id: number;
  classification: FreshnessClass;
  itemName: string;
}

const TOAST_META: Record<
  FreshnessClass,
  {
    label: string;
    message: string;
    icon: React.ComponentType<{ className?: string }>;
    shell: string;
    accent: string;
    ring: string;
  }
> = {
  fresh: {
    label: 'Fresh',
    message: 'Saved as fresh produce',
    icon: Leaf,
    shell: 'bg-emerald-50/95 border-emerald-200/90 text-emerald-950',
    accent: 'text-emerald-600',
    ring: 'ring-emerald-500/20',
  },
  'semi-fresh': {
    label: 'Semi-Fresh',
    message: 'Saved as semi-fresh',
    icon: Sparkles,
    shell: 'bg-amber-50/95 border-amber-200/90 text-amber-950',
    accent: 'text-amber-600',
    ring: 'ring-amber-500/20',
  },
  spoiled: {
    label: 'Spoiled',
    message: 'Saved as spoiled',
    icon: AlertTriangle,
    shell: 'bg-rose-50/95 border-rose-200/90 text-rose-950',
    accent: 'text-rose-600',
    ring: 'ring-rose-500/20',
  },
};

interface ClassificationToastProps {
  toast: ClassificationToastState | null;
  onDismiss: () => void;
}

export const ClassificationToast: React.FC<ClassificationToastProps> = ({ toast, onDismiss }) => {
  const meta = toast ? TOAST_META[toast.classification] : null;
  const Icon = meta?.icon ?? CheckCircle2;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5"
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="wait">
        {toast && meta && (
          <motion.div
            key={toast.id}
            role="status"
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className={`pointer-events-auto w-full max-w-[min(100%,24rem)] sm:max-w-md rounded-2xl border shadow-lg shadow-slate-900/10 backdrop-blur-md ring-1 ${meta.shell} ${meta.ring}`}
          >
            <div className="flex items-start gap-3 p-3.5 sm:p-4">
              <div
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/80 ${meta.accent}`}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-sm sm:text-base font-black tracking-tight">
                  Marked as {meta.label}
                </p>
                <p className="mt-0.5 text-xs sm:text-sm font-medium text-slate-600 truncate">
                  {toast.itemName}
                </p>
                <p className="mt-1 text-[11px] sm:text-xs text-slate-500">{meta.message}</p>
              </div>
              <button
                type="button"
                onClick={onDismiss}
                className="shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500 transition-colors hover:bg-white/60 hover:text-slate-800"
                aria-label="Dismiss notification"
              >
                OK
              </button>
            </div>
            <motion.div
              className={`h-1 origin-left rounded-b-2xl ${
                toast.classification === 'fresh'
                  ? 'bg-emerald-500'
                  : toast.classification === 'semi-fresh'
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
              }`}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: 2.4, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
