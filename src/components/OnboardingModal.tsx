import React, { useState } from 'react';
import { 
  Sparkles, 
  Heart, 
  AlertTriangle, 
  X, 
  ArrowRight 
} from 'lucide-react';
import { SupabaseConfig, UserSession } from '../types/freshness';
import { generateUserId, registerUserToSupabase, saveUserSession } from '../utils/assessmentStorage';

interface OnboardingModalProps {
  isOpen: boolean;
  currentUser: UserSession | null;
  supabaseConfig?: SupabaseConfig;
  onComplete: (user: UserSession) => void;
  onClose?: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  currentUser,
  supabaseConfig,
  onComplete,
  onClose,
}) => {
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleGetStarted = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const finalUserId = currentUser?.userId || generateUserId();
    const newSession: UserSession = {
      userId: finalUserId,
      userName: 'Evaluator',
      startedAt: new Date().toISOString(),
      avatarSeed: finalUserId,
    };

    saveUserSession(newSession);

    // Automatically send user creation to Supabase
    if (supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey) {
      try {
        await registerUserToSupabase(finalUserId, supabaseConfig);
      } catch (err) {
        console.warn('Initial Supabase user registration warning:', err);
      }
    }

    setIsSubmitting(false);
    onComplete(newSession);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-8 shadow-2xl border border-slate-200 relative overflow-hidden text-center max-h-[92vh] overflow-y-auto">
        {/* Soft decorative background accents */}
        <div className="absolute -top-16 -right-16 w-44 h-44 bg-emerald-100 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-44 h-44 bg-rose-100 rounded-full blur-2xl pointer-events-none" />

        {onClose && currentUser && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="relative z-10">
          {/* Brand Icon */}
          <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/25 text-white mb-3 sm:mb-4">
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
          </div>

          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Freshness Classifier
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xs mx-auto">
            Swipe through food images to assess and build high-quality freshness datasets.
          </p>

          {/* Dating-app Swipe Rules */}
          <div className="my-4 sm:my-6 p-3 sm:p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-left">
            <div className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2.5 sm:mb-3 text-center">
              Simple Swipe Controls
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
              <div className="p-2 sm:p-3 rounded-xl bg-white border border-emerald-200 shadow-2xs flex flex-col items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                  <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-emerald-500" />
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-emerald-900">Right</div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-emerald-600">Fresh</div>
              </div>

              <div className="p-2 sm:p-3 rounded-xl bg-white border border-amber-200 shadow-2xs flex flex-col items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-amber-900">Up</div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-amber-600">Semi-Fresh</div>
              </div>

              <div className="p-2 sm:p-3 rounded-xl bg-white border border-rose-200 shadow-2xs flex flex-col items-center">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-1">
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                </div>
                <div className="text-[11px] sm:text-xs font-bold text-rose-900">Left</div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-rose-600">Spoiled</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleGetStarted}>
            <button
              id="get-started-submit-btn"
              data-testid="onboarding-get-started-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-sm sm:text-base shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-98 cursor-pointer disabled:opacity-60"
            >
              <span>{isSubmitting ? 'Starting...' : 'Get Started'}</span>
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>

          <p className="text-[10px] sm:text-[11px] text-slate-400 mt-3">
            Instant evaluation session ready. No registration required.
          </p>
        </div>
      </div>
    </div>
  );
};
