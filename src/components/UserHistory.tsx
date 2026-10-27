import React, { useState } from 'react';
import { 
  Heart, 
  X, 
  AlertTriangle, 
  Download, 
  Trash2, 
  Search, 
  Calendar, 
  Folder, 
  User, 
  Layers,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { AssessmentRecord, FreshnessClass, UserSession } from '../types/freshness';
import { exportAssessmentsToCSV, exportAssessmentsToJSON } from '../utils/assessmentStorage';

interface UserHistoryProps {
  assessments: AssessmentRecord[];
  user: UserSession;
  onUpdateClassification: (id: string, newClass: FreshnessClass) => void;
  onDeleteAssessment: (id: string) => void;
  onNavigateToSwipe: () => void;
  isLoading?: boolean;
  errorMessage?: string | null;
}

export const UserHistory: React.FC<UserHistoryProps> = ({
  assessments,
  user,
  onUpdateClassification,
  onDeleteAssessment,
  onNavigateToSwipe,
  isLoading = false,
  errorMessage = null,
}) => {
  const [filterClass, setFilterClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const userAssessments = assessments.filter((a) => a.user_id === user.userId);

  const filtered = userAssessments.filter((item) => {
    const matchesClass = filterClass === 'all' || item.classification === filterClass;
    const matchesSearch = 
      item.image_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sub_folder?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.notes?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesClass && matchesSearch;
  });

  const freshCount = userAssessments.filter((a) => a.classification === 'fresh').length;
  const semiCount = userAssessments.filter((a) => a.classification === 'semi-fresh').length;
  const spoiledCount = userAssessments.filter((a) => a.classification === 'spoiled').length;

  const handleExportCSV = () => {
    const csv = exportAssessmentsToCSV(userAssessments);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user_${user.userId}_freshness_labels.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const json = exportAssessmentsToJSON(userAssessments);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `user_${user.userId}_freshness_labels.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-3 sm:py-4 px-3 sm:px-6">
      {/* Title & Stats Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                Label History
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              My Freshness Assessments
            </h2>
            <p className="text-xs text-slate-500">
              Review and manage your classified datasets. Every decision you swiped is saved here.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={userAssessments.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={handleExportJSON}
              disabled={userAssessments.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
          </div>
        </div>

        {/* Breakdown Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 pt-4">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Total Labeled
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {userAssessments.length}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
              <Heart className="w-3 h-3 fill-emerald-500" />
              Fresh
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-800 mt-0.5">
              {freshCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-100">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Semi-Fresh
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-800 mt-0.5">
              {semiCount}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-100">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center gap-1">
              <X className="w-3 h-3 stroke-[3]" />
              Spoiled
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-800 mt-0.5">
              {spoiledCount}
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs w-full sm:w-auto overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setFilterClass('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
              filterClass === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({userAssessments.length})
          </button>
          <button
            onClick={() => setFilterClass('fresh')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              filterClass === 'fresh'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-700 hover:bg-emerald-50'
            }`}
          >
            <Heart className="w-3 h-3 fill-current" />
            Fresh ({freshCount})
          </button>
          <button
            onClick={() => setFilterClass('semi-fresh')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              filterClass === 'semi-fresh'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-amber-700 hover:bg-amber-50'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Semi-Fresh ({semiCount})
          </button>
          <button
            onClick={() => setFilterClass('spoiled')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
              filterClass === 'spoiled'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-700 hover:bg-rose-50'
            }`}
          >
            <X className="w-3 h-3" />
            Spoiled ({spoiledCount})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search items, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs text-slate-800"
          />
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>Could not load your history from Supabase: {errorMessage}</span>
        </div>
      )}

      {/* Grid of Labeled Items */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((item) => {
            const isFresh = item.classification === 'fresh';
            const isSemi = item.classification === 'semi-fresh';
            const isSpoiled = item.classification === 'spoiled';

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 bg-slate-100 overflow-hidden">
                    <img
                      src={item.image_url}
                      alt={item.image_name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2.5 right-2.5">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-sm flex items-center gap-1 ${
                          isFresh
                            ? 'bg-emerald-600 text-white'
                            : isSemi
                            ? 'bg-amber-500 text-white'
                            : 'bg-rose-600 text-white'
                        }`}
                      >
                        {isFresh && <Heart className="w-3 h-3 fill-white" />}
                        {isSemi && <AlertTriangle className="w-3 h-3" />}
                        {isSpoiled && <X className="w-3 h-3 stroke-[3]" />}
                        {item.classification.toUpperCase()}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2">
                      <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                        {item.parent_folder} / {item.sub_folder}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-1">
                      {item.image_name}
                    </h4>

                    {item.notes && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {item.notes}
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(item.assessed_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Re-classify or delete */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">Switch:</span>
                    <button
                      onClick={() => onUpdateClassification(item.id, 'fresh')}
                      title="Set to Fresh"
                      className={`p-1 rounded-md transition-colors ${
                        isFresh
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'hover:bg-slate-200 text-slate-400'
                      }`}
                    >
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button
                      onClick={() => onUpdateClassification(item.id, 'semi-fresh')}
                      title="Set to Semi-Fresh"
                      className={`p-1 rounded-md transition-colors ${
                        isSemi
                          ? 'bg-amber-100 text-amber-800'
                          : 'hover:bg-slate-200 text-slate-400'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onUpdateClassification(item.id, 'spoiled')}
                      title="Set to Spoiled"
                      className={`p-1 rounded-md transition-colors ${
                        isSpoiled
                          ? 'bg-rose-100 text-rose-800'
                          : 'hover:bg-slate-200 text-slate-400'
                      }`}
                    >
                      <X className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>

                  <button
                    onClick={() => onDeleteAssessment(item.id)}
                    title="Remove from history"
                    className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            No Assessments Found
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
            {isLoading
              ? 'Loading your history from Supabase…'
              : userAssessments.length === 0
              ? 'You have not swiped any food images yet. Hop onto the dating-app swipe screen to start labeling!'
              : 'No items match your filter criteria.'}
          </p>
          <button
            onClick={onNavigateToSwipe}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5 transition-colors"
          >
            <span>Start Swiping Images</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
