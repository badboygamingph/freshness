import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  User, 
  Key, 
  ArrowRight, 
  ShieldCheck, 
  LogOut, 
  ArrowLeft,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { 
  AssessmentRecord, 
  DatasetItem, 
  FolderNode, 
  ImportFolderInput, 
  SupabaseConfig 
} from '../types/freshness';
import { ADMIN_CREDENTIALS, verifyAdminCredentials } from '../utils/assessmentStorage';

interface AdminPortalProps {
  folders: FolderNode[];
  items: DatasetItem[];
  allAssessments: AssessmentRecord[];
  isAssessmentsLoading?: boolean;
  assessmentsError?: string | null;
  onRefreshAssessments?: () => Promise<{ count: number; error?: string }>;
  supabaseConfig: SupabaseConfig;
  onSaveSupabaseConfig: (config: SupabaseConfig) => void;
  onCreateFolder: (name: string, parentId: string | null, isParent: boolean) => void;
  onDeleteFolder: (folderId: string) => void;
  onCreateItem: (item: Omit<DatasetItem, 'id' | 'uploadedAt'>) => void;
  onBulkImport: (
    folders: ImportFolderInput[],
    items: Omit<DatasetItem, 'id' | 'uploadedAt'>[]
  ) => { createdFolders: number; createdItems: number; error?: string };
  onUpdateItem: (id: string, updates: Partial<DatasetItem>) => void;
  onDeleteItem: (id: string) => void;
  onDeleteAssessment: (id: string) => void;
  onDeleteAssessmentsBulk: (ids: string[]) => void;
  onReloadDefaults: () => void;
  onRemoveDuplicateFolders: () => void;
  onExitAdmin: () => void;
}

const ADMIN_STORAGE_KEY = 'freshness_admin_auth_v1';

export const AdminPortal: React.FC<AdminPortalProps> = (props) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem(ADMIN_STORAGE_KEY) === 'true';
  });
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (verifyAdminCredentials(username, password)) {
      setIsAuthenticated(true);
      sessionStorage.setItem(ADMIN_STORAGE_KEY, 'true');
    } else {
      setErrorMsg('Invalid administrator credentials. Please check your username and password.');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem(ADMIN_STORAGE_KEY);
    setUsername('');
    setPassword('');
  };

  // If already authenticated, show the admin dashboard with top header bar
  if (isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <header className="bg-slate-900 text-white border-b border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between shadow-sm gap-2">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-indigo-500 flex items-center justify-center text-white font-bold shrink-0">
              <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-xs sm:text-sm tracking-tight whitespace-nowrap">
                  Admin Console
                </span>
                <span className="hidden xs:inline-flex text-[10px] bg-indigo-500/30 text-indigo-300 px-1.5 py-0.2 rounded-full font-mono">
                  /administrator
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={props.onExitAdmin}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1 sm:gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to App</span>
              <span className="sm:hidden">Back</span>
            </button>
            <button
              onClick={handleLogout}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </header>

        <main className="flex-1">
          <AdminDashboard {...props} onRemoveDuplicateFolders={props.onRemoveDuplicateFolders} />
        </main>
      </div>
    );
  }

  // Not authenticated: Show dedicated light-theme login page
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-3 sm:p-4">
      {/* Back button */}
      <div className="w-full max-w-md mb-4 flex justify-between items-center px-1">
        <button
          onClick={props.onExitAdmin}
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Freshness</span>
        </button>
        <span className="text-[11px] font-mono text-slate-400">/administrator</span>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 shadow-xl p-5 sm:p-8 relative overflow-hidden">
        {/* Soft decorative accents */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-indigo-100 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10">
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-4 sm:mb-5 mx-auto">
            <Lock className="w-6 h-6 sm:w-7 sm:h-7" />
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-center text-slate-900 tracking-tight">
            Administrator Portal
          </h2>
          <p className="text-xs text-center text-slate-500 mt-1 mb-6">
            Sign in to manage datasets, folder hierarchies, and Supabase database synchronization.
          </p>

          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  id="admin-username-input"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="admin-password-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="admin-login-submit-btn"
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Access Administrator Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 font-medium">
              Secure administrator access for dataset management.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
