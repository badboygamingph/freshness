import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'motion/react';
import { 
  X, 
  AlertTriangle, 
  RotateCcw, 
  Folder, 
  Layers, 
  CheckCircle2, 
  Flame,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  Maximize2,
  RefreshCw
} from 'lucide-react';
import { AssessmentRecord, DatasetItem, FreshnessClass, UserSession } from '../types/freshness';

// Minimum time the undo loading state stays on screen so the revert is clearly visible.
const UNDO_LOADING_MS = 600;

function matchesFolderFilter(
  parentFolder: string,
  subFolder: string,
  filter: string
): boolean {
  if (filter === 'all') return true;
  const fullPath = `${parentFolder} / ${subFolder}`;
  return fullPath === filter || subFolder === filter;
}

interface DatingCardDeckProps {
  items: DatasetItem[];
  allItems: DatasetItem[];
  userAssessments: AssessmentRecord[];
  user: UserSession;
  onRecordAssessment: (record: AssessmentRecord) => void;
  onUndoLastAssessment?: () => void | Promise<void>;
  lastAssessedRecord: AssessmentRecord | null;
  onNavigateToHistory: () => void;
  onNavigateToAdmin: () => void;
  availableFolders: string[];
  isLoading?: boolean;
  errorMessage?: string | null;
  onRefresh?: () => void;
}

export const DatingCardDeck: React.FC<DatingCardDeckProps> = React.memo(({
  items,
  allItems,
  userAssessments,
  user,
  onRecordAssessment,
  onUndoLastAssessment,
  lastAssessedRecord,
  onNavigateToHistory,
  onNavigateToAdmin,
  availableFolders,
  isLoading = false,
  errorMessage = null,
  onRefresh,
}) => {
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [streak, setStreak] = useState<number>(0);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [isUndoing, setIsUndoing] = useState<boolean>(false);
  // Filter items by folder if chosen - Memoized for performance
  const filteredItems = React.useMemo(() => {
    return items.filter((item) => {
      if (selectedFolderFilter === 'all') return true;
      const fullPath = `${item.parentFolder} / ${item.subFolder}`;
      return fullPath === selectedFolderFilter || item.subFolder === selectedFolderFilter;
    });
  }, [items, selectedFolderFilter]);

  const scopedAllItems = React.useMemo(() => {
    return allItems.filter((item) =>
      matchesFolderFilter(item.parentFolder, item.subFolder, selectedFolderFilter)
    );
  }, [allItems, selectedFolderFilter]);

  const completedInScope = React.useMemo(() => {
    const scopedIds = new Set(scopedAllItems.map((item) => item.id));
    return userAssessments.filter((record) => scopedIds.has(record.image_id)).length;
  }, [scopedAllItems, userAssessments]);

  const totalInScope = scopedAllItems.length;
  const remainingInScope = filteredItems.length;
  const progressPercent =
    totalInScope > 0 ? Math.min(100, Math.round((completedInScope / totalInScope) * 100)) : 0;
  const currentCardNumber = Math.min(completedInScope + 1, totalInScope);

  // We always show the first item of the provided (already filtered) list.
  // App.tsx handles removing evaluated items from this list.
  const currentItem = filteredItems[0];
  const nextItem = filteredItems[1];

  // Drag physics tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-18, 18]);

  // Dynamic stamp opacities
  const freshOpacity = useTransform(x, [40, 140], [0, 1]);
  const spoiledOpacity = useTransform(x, [-40, -140], [0, 1]);
  const semiFreshOpacity = useTransform(y, [-40, -130], [0, 1]);

  const resetCardPosition = () => {
    x.set(0);
    y.set(0);
  };

  useEffect(() => {
    resetCardPosition();
  }, [currentItem?.id]);

  const handleClassify = (classification: FreshnessClass) => {
    if (!currentItem) return;

    const record: AssessmentRecord = {
      id: 'rec_' + Math.random().toString(36).substring(2, 10),
      user_id: user.userId,
      image_id: currentItem.id,
      image_name: currentItem.name,
      image_url: currentItem.imageUrl,
      parent_folder: currentItem.parentFolder,
      sub_folder: currentItem.subFolder,
      classification,
      assessed_at: new Date().toISOString(),
      notes: currentItem.description || '',
    };

    resetCardPosition();
    onRecordAssessment(record);
    setStreak((prev) => prev + 1);
    // Note: We don't increment currentIndex here because App.tsx will 
    // remove the evaluated item from the 'items' list, which updates 
    // this component and effectively moves us to the "next" item.
  };

  const handleDragEnd = (_: any, info: any) => {
    const swipeThreshold = 100;
    const verticalThreshold = -90;

    if (info.offset.y < verticalThreshold && Math.abs(info.offset.x) < 80) {
      // Swiped Up -> Semi-Fresh
      handleClassify('semi-fresh');
    } else if (info.offset.x > swipeThreshold) {
      // Swiped Right -> Fresh
      handleClassify('fresh');
    } else if (info.offset.x < -swipeThreshold) {
      // Swiped Left -> Spoiled
      handleClassify('spoiled');
    }
  };

  const handleUndo = async () => {
    if (isUndoing || !lastAssessedRecord) return;
    setIsUndoing(true);
    try {
      // Keep the loading state on screen for a moment so the revert is clearly visible,
      // while the verdict is being removed from Supabase in the background.
      await Promise.all([
        onUndoLastAssessment ? Promise.resolve(onUndoLastAssessment()) : Promise.resolve(),
        new Promise((resolve) => setTimeout(resolve, UNDO_LOADING_MS)),
      ]);
      // The item will reappear in the list via App.tsx update.
      setStreak((prev) => Math.max(0, prev - 1));
      resetCardPosition();
    } finally {
      setIsUndoing(false);
    }
  };

  const handleRestart = () => {
    setStreak(0);
  };

  const isCompleted = filteredItems.length === 0;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center select-none py-2">
      {/* Header Controls: Folder selector & Streak - Hidden on Mobile */}
      <div className="w-full hidden sm:flex items-center justify-between mb-3 px-2">
        <div className="flex items-center gap-1.5 bg-white border border-slate-200/90 rounded-xl px-2.5 py-1 shadow-2xs">
          <Folder className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={selectedFolderFilter}
            onChange={(e) => {
              setSelectedFolderFilter(e.target.value);
              resetCardPosition();
            }}
            className="text-xs font-semibold text-slate-700 bg-transparent border-none focus:outline-none cursor-pointer pr-1"
          >
            <option value="all">All Folders ({items.length})</option>
            {availableFolders.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>

        {streak > 0 && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-orange-50 border border-orange-200 text-orange-600 text-xs font-bold animate-pulse">
            <Flame className="w-3.5 h-3.5 fill-orange-500" />
            <span>{streak} Streak!</span>
          </div>
        )}

        <div className="text-xs font-bold text-slate-500">
          {!isCompleted && totalInScope > 0 && `${currentCardNumber} / ${totalInScope}`}
        </div>
      </div>

      {/* Evaluation progress — emphasized on mobile so evaluators see how close they are */}
      {!isLoading && totalInScope > 0 && (
        <div
          className="w-full mb-3 sm:mb-4 px-1"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Evaluation progress: ${completedInScope} of ${totalInScope} images completed`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[11px] sm:text-xs font-bold text-slate-600 uppercase tracking-wide">
              Progress
            </span>
            <span className="text-xs sm:text-sm font-black text-emerald-700 tabular-nums">
              {completedInScope} / {totalInScope}
              <span className="text-slate-400 font-semibold ml-1">({progressPercent}%)</span>
            </span>
          </div>
          <div className="w-full h-2.5 sm:h-1.5 bg-slate-200 rounded-full overflow-hidden shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="sm:hidden text-[11px] text-slate-500 mt-1.5 text-center font-medium">
            {remainingInScope === 0
              ? 'You finished all images in this set!'
              : `${remainingInScope} image${remainingInScope === 1 ? '' : 's'} left — almost there!`}
          </p>
        </div>
      )}

      {/* Main Card Deck Area */}
      <div className="relative w-full h-[400px] sm:h-[460px] md:h-[500px] flex items-center justify-center">
        <AnimatePresence mode="popLayout">
          {isLoading ? (
            /* Loading Screen — images are fetched from Supabase */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full bg-white rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center p-6"
            >
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mb-3" />
              <h3 className="text-base font-bold text-slate-900">Loading images…</h3>
              <p className="text-xs text-slate-500 mt-1">Fetching the dataset from Supabase.</p>
            </motion.div>
          ) : filteredItems.length === 0 ? (
            /* Empty / No Data Screen */
            <motion.div
              key="empty"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full h-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 flex flex-col items-center justify-center text-center"
            >
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  errorMessage ? 'bg-amber-50 text-amber-500' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {errorMessage ? <AlertTriangle className="w-8 h-8" /> : <Layers className="w-8 h-8" />}
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-1">
                {errorMessage ? 'Could Not Load Images' : items.length === 0 ? 'No Images Available' : 'Evaluation Complete!'}
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mb-5">
                {errorMessage
                  ? errorMessage
                  : items.length === 0
                  ? (selectedFolderFilter !== 'all'
                    ? 'No images were found in this folder.'
                    : 'There are no dataset images in Supabase yet. An administrator needs to upload images before you can start labeling.')
                  : "You've finished evaluating all images in this dataset! You can check your history or wait for new images to be uploaded."}
              </p>

              <div className="w-full space-y-2">
                {onRefresh && (
                  <button
                    onClick={onRefresh}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Refresh</span>
                  </button>
                )}

                <button
                  onClick={onNavigateToAdmin}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Upload Datasets in Admin</span>
                </button>
              </div>
            </motion.div>
          ) : !isCompleted && currentItem ? (
            <div className="relative w-full h-full">
              {/* Ghost Next Card (Stack effect) */}
              {nextItem && (
                <div 
                  className="absolute inset-0 bg-white rounded-3xl border border-slate-200 shadow-md overflow-hidden transform scale-95 translate-y-3 opacity-70 pointer-events-none"
                  aria-hidden="true"
                >
                  <img
                    src={nextItem.imageUrl}
                    alt={nextItem.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                </div>
              )}

              {/* Top Active Card */}
              <motion.div
                key={currentItem.id}
                style={{ x, y, rotate }}
                drag
                dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={0.7}
                onDragEnd={handleDragEnd}
                whileTap={{ cursor: 'grabbing' }}
                className="absolute inset-0 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden cursor-grab flex flex-col justify-between will-change-transform"
              >
                {/* Stamp: FRESH (Right Drag) */}
                <motion.div
                  style={{ opacity: freshOpacity }}
                  className="absolute top-4 sm:top-6 left-4 sm:left-6 z-30 pointer-events-none border-3 sm:border-4 border-emerald-500 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1 sm:py-1.5 -rotate-12 bg-emerald-50/90 shadow-lg"
                >
                  <span className="text-xl sm:text-2xl font-black text-emerald-600 tracking-wider">
                    FRESH
                  </span>
                </motion.div>

                {/* Stamp: SPOILED (Left Drag) */}
                <motion.div
                  style={{ opacity: spoiledOpacity }}
                  className="absolute top-4 sm:top-6 right-4 sm:right-6 z-30 pointer-events-none border-3 sm:border-4 border-rose-500 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1 sm:py-1.5 rotate-12 bg-rose-50/90 shadow-lg"
                >
                  <span className="text-xl sm:text-2xl font-black text-rose-600 tracking-wider">
                    SPOILED
                  </span>
                </motion.div>

                {/* Stamp: SEMI-FRESH (Up Drag) */}
                <motion.div
                  style={{ opacity: semiFreshOpacity }}
                  className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none border-3 sm:border-4 border-amber-500 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-1 sm:py-1.5 bg-amber-50/95 shadow-lg whitespace-nowrap"
                >
                  <span className="text-xl sm:text-2xl font-black text-amber-600 tracking-wider">
                    SEMI-FRESH
                  </span>
                </motion.div>

                {/* Card Media Header - Now filling the entire card */}
                <div className="relative w-full h-full bg-slate-100 overflow-hidden shrink-0">
                  <img
                    src={currentItem.imageUrl}
                    alt={currentItem.name}
                    loading="eager"
                    fetchPriority="high"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Top tags on image */}
                  <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 right-2.5 sm:right-3 flex items-center justify-between z-10">
                    <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-bold tracking-wide flex items-center gap-1 sm:gap-1.5 max-w-[80%] truncate">
                      <Folder className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">{currentItem.parentFolder} / {currentItem.subFolder}</span>
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setZoomImage(currentItem.imageUrl);
                      }}
                      className="p-1 sm:p-1.5 rounded-full bg-black/50 hover:bg-black/80 text-white backdrop-blur-md transition-colors shrink-0"
                      title="Zoom Image"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Food Name and Description on bottom overlay */}
                  <div className="absolute bottom-4 left-4 right-4 text-white z-10">
                    <h3 className="text-xl sm:text-2xl font-black leading-tight drop-shadow-lg truncate mb-1">
                      {currentItem.name}
                    </h3>
                    
                    {currentItem.description && (
                      <p className="text-xs text-white/90 line-clamp-2 leading-relaxed drop-shadow-md mb-2">
                        {currentItem.description}
                      </p>
                    )}

                    {currentItem.tags && currentItem.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {currentItem.tags.map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-white text-[10px] font-semibold border border-white/10"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          ) : (
            /* Completed Deck Screen */
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full h-full bg-white rounded-3xl border border-slate-200 shadow-xl p-6 flex flex-col items-center justify-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 mb-4">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h3 className="text-2xl font-black text-slate-900 mb-1">
                Thank You for Evaluating!
              </h3>
              <p className="text-xs text-slate-500 max-w-xs mb-6">
                You've successfully classified all {totalInScope} samples in this batch. Your valuable feedback helps improve the freshness model.
              </p>

              <div className="w-full space-y-2 mb-6">
                <button
                  onClick={onNavigateToHistory}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Review My Classified Labels</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={handleRestart}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Classify Again</span>
                </button>

                <button
                  onClick={onNavigateToAdmin}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Upload More Datasets in Admin</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Undo loading overlay — visible while the last verdict is reverted in Supabase */}
        <AnimatePresence>
          {isUndoing && (
            <motion.div
              key="undoing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-white/90 backdrop-blur-sm rounded-3xl border border-slate-200 shadow-xl flex flex-col items-center justify-center text-center p-6"
            >
              <RefreshCw className="w-8 h-8 text-slate-600 animate-spin mb-3" />
              <h3 className="text-base font-bold text-slate-900">Undoing last swipe…</h3>
              <p className="text-xs text-slate-500 mt-1">
                Removing the verdict and restoring the previous image.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Classification Action Controls Bar with Clear Text Buttons */}
      {!isCompleted && currentItem && (
        <div className="w-full mt-3 sm:mt-5 flex flex-col items-center gap-2 sm:gap-3 px-1 sm:px-4">
          {/* Main 3 Text Classification Buttons */}
          <div className="w-full max-w-lg grid grid-cols-3 gap-1.5 sm:gap-3">
            {/* Spoiled Button (Text Button) */}
            <button
              type="button"
              onClick={() => handleClassify('spoiled')}
              disabled={isUndoing}
              aria-label="Classify as Spoiled"
              className="py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl bg-white hover:bg-rose-50 border-2 border-rose-300 hover:border-rose-500 text-rose-700 shadow-2xs hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex flex-col items-center justify-center cursor-pointer group"
            >
              <span className="text-xs xs:text-sm sm:text-base font-black tracking-wider uppercase text-rose-600 group-hover:text-rose-700 whitespace-nowrap">
                Spoiled
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-rose-500 mt-0.5 flex items-center gap-0.5 sm:gap-1">
                <ArrowLeft className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Left
              </span>
            </button>

            {/* Semi-Fresh Button (Text Button) */}
            <button
              type="button"
              onClick={() => handleClassify('semi-fresh')}
              disabled={isUndoing}
              aria-label="Classify as Semi-Fresh"
              className="py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl bg-white hover:bg-amber-50 border-2 border-amber-300 hover:border-amber-500 text-amber-800 shadow-2xs hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex flex-col items-center justify-center cursor-pointer group"
            >
              <span className="text-xs xs:text-sm sm:text-base font-black tracking-wider uppercase text-amber-600 group-hover:text-amber-700 whitespace-nowrap">
                Semi-Fresh
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-amber-600 mt-0.5 flex items-center gap-0.5 sm:gap-1">
                <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> Up
              </span>
            </button>

            {/* Fresh Button (Text Button) */}
            <button
              type="button"
              onClick={() => handleClassify('fresh')}
              disabled={isUndoing}
              aria-label="Classify as Fresh"
              className="py-2.5 sm:py-3.5 px-1 sm:px-3 rounded-xl sm:rounded-2xl bg-white hover:bg-emerald-50 border-2 border-emerald-400 hover:border-emerald-600 text-emerald-700 shadow-2xs hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex flex-col items-center justify-center cursor-pointer group"
            >
              <span className="text-xs xs:text-sm sm:text-base font-black tracking-wider uppercase text-emerald-600 group-hover:text-emerald-700 whitespace-nowrap">
                Fresh
              </span>
              <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-600 mt-0.5 flex items-center gap-0.5 sm:gap-1">
                Right <ArrowRight className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
            </button>
          </div>

          {/* Undo Button with Text */}
          <div className="flex items-center justify-center pt-0.5 sm:pt-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!lastAssessedRecord || isUndoing}
              aria-busy={isUndoing}
              aria-label="Undo previous swipe"
              className="py-1.5 sm:py-2 px-3 sm:px-4 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-30 disabled:pointer-events-none cursor-pointer border border-slate-200"
            >
              <RotateCcw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-500 ${isUndoing ? 'animate-spin' : ''}`} />
              <span>{isUndoing ? 'Undoing…' : 'Undo Last Swipe'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Zoom Modal */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
        >
          <div className="relative max-w-2xl w-full max-h-[85vh] bg-transparent flex items-center justify-center">
            <img 
              src={zoomImage} 
              alt="Enlarged view" 
              className="max-h-[80vh] w-auto rounded-2xl shadow-2xl object-contain" 
            />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
