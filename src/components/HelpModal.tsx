import React from 'react';
import { 
  X, 
  Heart, 
  AlertTriangle, 
  Check, 
  HelpCircle,
  Undo2
} from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Freshness Classifier Guide
              </h3>
              <p className="text-[11px] text-slate-500">
                Simple steps to check and rate food freshness
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Simple English Guide Content */}
        <div className="py-4 space-y-4 text-xs text-slate-600">
          {/* Step 1: Meaning of the 3 choices */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
            <h4 className="font-bold text-slate-900 mb-2 text-xs flex items-center gap-1.5">
              <span>What do the 3 choices mean?</span>
            </h4>
            <div className="space-y-2 text-slate-700">
              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[10px] shrink-0">
                  Fresh
                </span>
                <p>
                  The food is in good condition, looks clean, has bright color, and is safe to eat.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px] shrink-0">
                  Semi-Fresh
                </span>
                <p>
                  The food is still okay, but it has small spots, wrinkly skin, or is starting to get soft.
                </p>
              </div>

              <div className="flex items-start gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[10px] shrink-0">
                  Spoiled
                </span>
                <p>
                  The food is bad, rotten, decayed, or has mold. It is NOT safe to eat.
                </p>
              </div>
            </div>
          </div>

          {/* Step 2: How to rate */}
          <div>
            <h4 className="font-bold text-slate-900 mb-1.5 text-xs">
              How to rate each food photo
            </h4>
            <ul className="space-y-1.5 pl-4 list-disc text-slate-600">
              <li>
                <strong>To choose Fresh:</strong> Click the green <strong>"Fresh"</strong> button, or swipe the card to the <strong>Right</strong>.
              </li>
              <li>
                <strong>To choose Semi-Fresh:</strong> Click the yellow <strong>"Semi-Fresh"</strong> button, or swipe the card <strong>Up</strong>.
              </li>
              <li>
                <strong>To choose Spoiled:</strong> Click the red <strong>"Spoiled"</strong> button, or swipe the card to the <strong>Left</strong>.
              </li>
              <li>
                <strong>Made a mistake?</strong> Click the <strong>Undo Last Action</strong> button to go back to the previous photo.
              </li>
            </ul>
          </div>

          {/* Step 3: Your User ID */}
          <div>
            <h4 className="font-bold text-slate-900 mb-1 text-xs">
              Your Evaluator ID
            </h4>
            <p className="text-slate-600">
              When you clicked <strong>"Get Started"</strong>, the system gave you a unique ID number automatically. Every time you rate a photo, your answer is saved to your account so the admin can review your progress.
            </p>
          </div>

          {/* Step 4: Folders */}
          <div>
            <h4 className="font-bold text-slate-900 mb-1 text-xs">
              Folder Organization
            </h4>
            <p className="text-slate-600">
              Photos are stored in the main folder <strong>FRESHNESS ASSESSMENT</strong> under three subfolders: <code>fresh</code>, <code>semi-fresh</code>, and <code>spoiled</code>.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Got it, Let's Start!
          </button>
        </div>
      </div>
    </div>
  );
};
