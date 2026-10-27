import React from 'react';
import { 
  Layers, 
  UserCheck, 
  ShieldCheck, 
  HelpCircle, 
  CheckCircle,
  Copy,
  LogOut,
  RefreshCw
} from 'lucide-react';
import { UserSession } from '../types/freshness';

interface NavbarProps {
  currentTab: 'swipe' | 'history';
  onSelectTab: (tab: 'swipe' | 'history') => void;
  user: UserSession | null;
  onOpenOnboarding: () => void;
  onOpenHelp: () => void;
  onNavigateAdmin: () => void;
  totalUserAssessments: number;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  currentTab,
  onSelectTab,
  user,
  onOpenOnboarding,
  onOpenHelp,
  onNavigateAdmin,
  totalUserAssessments,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs w-full">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-1.5 sm:gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg md:text-xl tracking-tight text-slate-900">
                Freshness
              </span>
              <span className="hidden md:inline-flex text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                AI Dataset Hub
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 hidden lg:block">
              Swipe-based Freshness Assessment
            </p>
          </div>
        </div>

        {/* Center Navigation Tabs: Swipe & Labels */}
        <nav className="flex items-center p-0.5 sm:p-1 bg-slate-100 rounded-xl border border-slate-200/80 shrink-0">
          <button
            onClick={() => onSelectTab('swipe')}
            className={`px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 ${
              currentTab === 'swipe'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Assess (Swipe)</span>
            <span className="sm:hidden">Assess</span>
          </button>

          <button
            onClick={() => onSelectTab('history')}
            className={`px-2 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1 sm:gap-1.5 ${
              currentTab === 'history'
                ? 'bg-white text-emerald-700 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">My Labels</span>
            <span className="sm:hidden">Labels</span>
            {totalUserAssessments > 0 && (
              <span className="ml-0.5 sm:ml-1 px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                {totalUserAssessments}
              </span>
            )}
          </button>
        </nav>

        {/* Right Section: Ready / Help / Admin */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-1 px-1.5 sm:px-2.5 py-1 rounded-xl bg-emerald-50/80 border border-emerald-200/80 text-emerald-800 text-xs font-semibold" title="Ready to Swipe">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="hidden md:inline text-[11px]">Ready</span>
            </div>
          ) : (
            <button
              onClick={onOpenOnboarding}
              className="hidden sm:inline-flex px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors whitespace-nowrap"
            >
              Get Started
            </button>
          )}

          <button
            onClick={onOpenHelp}
            title="How to swipe"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <HelpCircle className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          <button
            onClick={onNavigateAdmin}
            title="Administrator Portal (/administrator)"
            className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>
        </div>
      </div>
    </header>
  );
});
