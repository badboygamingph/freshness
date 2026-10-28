import React, { useState, useEffect } from 'react';
import { 
  AssessmentRecord, 
  DatasetItem, 
  FolderNode, 
  FreshnessClass, 
  ImportFolderInput, 
  SupabaseConfig, 
  UserSession 
} from './types/freshness';
import { 
  DEFAULT_DATASET_ITEMS,
  DEFAULT_FOLDERS,
  deleteAssessmentByUserAndImageFromSupabase,
  deleteAssessmentFromSupabase,
  deleteAssessmentsBulkFromSupabase,
  deleteDatasetItemsFromSupabase,
  deleteFoldersFromSupabase,
  fetchAllAssessmentsFromSupabase,
  fetchDatasetItemsFromSupabase,
  fetchFoldersFromSupabase,
  fetchUserAssessmentsFromSupabase,
  getDatasetItems,
  getFolders,
  getSupabaseConfig,
  getUserSession,
  resetDatasetToDefaults,
  saveDatasetItems,
  saveFolders,
  saveSupabaseConfig,
  syncRecordToSupabase,
  updateAssessmentClassificationInSupabase,
  upsertDatasetItemsToSupabase,
  upsertFoldersToSupabase
} from './utils/assessmentStorage';
import { Navbar } from './components/Navbar';
import { OnboardingModal } from './components/OnboardingModal';
import { DatingCardDeck } from './components/DatingCardDeck';
import { UserHistory } from './components/UserHistory';
import { AdminPortal } from './components/AdminPortal';
import { HelpModal } from './components/HelpModal';
import { ShieldCheck } from 'lucide-react';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    return window.location.pathname.startsWith('/administrator') ? '/administrator' : '/';
  });

  const [user, setUser] = useState<UserSession | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [currentTab, setCurrentTab] = useState<'swipe' | 'history'>('swipe');

  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [items, setItems] = useState<DatasetItem[]>([]);
  const [allAssessments, setAllAssessments] = useState<AssessmentRecord[]>([]);
  const [isAllAssessmentsLoading, setIsAllAssessmentsLoading] = useState<boolean>(true);
  const [allAssessmentsError, setAllAssessmentsError] = useState<string | null>(null);
  const [supabaseConfig, setSupabaseConfig] = useState<SupabaseConfig>(getSupabaseConfig());
  const [lastAssessed, setLastAssessed] = useState<AssessmentRecord | null>(null);
  const [assessmentUndoStack, setAssessmentUndoStack] = useState<AssessmentRecord[]>([]);

  // Evaluator-facing data — always sourced from Supabase (empty by default)
  const [userItems, setUserItems] = useState<DatasetItem[]>([]);
  const [isUserItemsLoading, setIsUserItemsLoading] = useState<boolean>(true);
  const [userItemsError, setUserItemsError] = useState<string | null>(null);
  const [userAssessments, setUserAssessments] = useState<AssessmentRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState<boolean>(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const filteredUserItems = React.useMemo(() => {
    const assessedIds = new Set(userAssessments.map(a => a.image_id));
    return userItems.filter(item => !assessedIds.has(item.id));
  }, [userItems, userAssessments]);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setCurrentRoute(path.startsWith('/administrator') ? '/administrator' : '/');
  };

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname.startsWith('/administrator') ? '/administrator' : '/');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Dataset images + folders live in Supabase so every device/admin sees the same data.
  const refreshDatasetFromSupabase = async () => {
    const config = getSupabaseConfig();
    const [foldersResult, itemsResult] = await Promise.all([
      fetchFoldersFromSupabase(config),
      fetchDatasetItemsFromSupabase(config),
    ]);

    if (foldersResult.error) {
      // Folders table unavailable — keep whatever we have, otherwise fall back to the local tree.
      setFolders((prev) => (prev.length > 0 ? prev : getFolders()));
    } else if (foldersResult.folders.length === 0) {
      // First run: seed the standard folder tree into Supabase so the admin tree is never blank.
      setFolders(DEFAULT_FOLDERS);
      upsertFoldersToSupabase(DEFAULT_FOLDERS, config).catch(() => undefined);
    } else {
      setFolders(foldersResult.folders);
    }

    // Supabase is the single source of truth for the dataset images.
    setItems(itemsResult.error ? [] : itemsResult.items);
  };

  // Initialize data on mount
  useEffect(() => {
    const existingUser = getUserSession();
    if (existingUser) {
      setUser(existingUser);
    } else {
      // First-time user: automatically open Onboarding with Get Started button
      setIsOnboardingOpen(true);
    }

    refreshDatasetFromSupabase();
    setSupabaseConfig(getSupabaseConfig());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isSupabaseReady = (config: SupabaseConfig) => Boolean(config.url && config.anonKey);

  // Load the evaluator image deck straight from Supabase
  const loadUserItems = async () => {
    setIsUserItemsLoading(true);
    setUserItemsError(null);
    const result = await fetchDatasetItemsFromSupabase(getSupabaseConfig());
    setUserItems(result.items);
    setUserItemsError(result.error ?? null);
    setIsUserItemsLoading(false);
  };

  // Load the evaluator's own history straight from Supabase
  const loadUserAssessments = async (userId: string) => {
    setIsHistoryLoading(true);
    setHistoryError(null);
    const result = await fetchUserAssessmentsFromSupabase(userId, getSupabaseConfig());
    setUserAssessments(result.records);
    setHistoryError(result.error ?? null);
    setIsHistoryLoading(false);
  };

  // Load every evaluator verdict from Supabase (drives the admin audit trail)
  const loadAllAssessments = async (): Promise<{ count: number; error?: string }> => {
    setIsAllAssessmentsLoading(true);
    setAllAssessmentsError(null);
    const result = await fetchAllAssessmentsFromSupabase(getSupabaseConfig());
    setAllAssessments(result.records);
    setAllAssessmentsError(result.error ?? null);
    setIsAllAssessmentsLoading(false);
    return { count: result.records.length, error: result.error };
  };

  // Reload data whenever the Supabase connection, active evaluator or route changes
  useEffect(() => {
    loadUserItems();
    
    // Only load all assessments (admin trail) if we are in the administrator portal
    if (currentRoute.startsWith('/administrator')) {
      loadAllAssessments();
      refreshDatasetFromSupabase();
    }
    
    if (user) {
      loadUserAssessments(user.userId);
    } else {
      setUserAssessments([]);
      setIsHistoryLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    supabaseConfig.url,
    supabaseConfig.anonKey,
    supabaseConfig.tableName,
    user?.userId,
    currentRoute,
  ]);

  // Admin-side push helpers (dataset images live in Supabase so evaluators can see them)
  const pushItemsToSupabase = (bucket: DatasetItem[]) => {
    const config = getSupabaseConfig();
    if (!isSupabaseReady(config) || bucket.length === 0) return;
    upsertDatasetItemsToSupabase(bucket, config).catch((err) =>
      console.warn('Dataset push to Supabase failed:', err)
    );
  };

  const removeItemsFromSupabase = (ids: string[]) => {
    const config = getSupabaseConfig();
    if (!isSupabaseReady(config) || ids.length === 0) return;
    deleteDatasetItemsFromSupabase(ids, config).catch((err) =>
      console.warn('Dataset delete on Supabase failed:', err)
    );
  };

  // Handlers for assessments — every swipe/click verdict is persisted in Supabase, not localStorage
  const handleRecordAssessment = async (record: AssessmentRecord) => {
    setLastAssessed(record);
    setAssessmentUndoStack((prev) => [...prev, record]);

    const config = getSupabaseConfig();
    if (!isSupabaseReady(config)) {
      console.warn('Assessment not stored: Supabase is not configured.');
      return;
    }

    // One verdict per evaluator per image — drop any earlier answer before inserting the new one
    await deleteAssessmentByUserAndImageFromSupabase(record.user_id, record.image_id, config);
    const stored = await syncRecordToSupabase(record, config);
    if (!stored) {
      console.warn(`Failed to store the "${record.classification}" verdict for ${record.image_name}.`);
    }

    await loadAllAssessments();
    if (user) await loadUserAssessments(user.userId);
  };

  const handleUndoLastAssessment = async () => {
    const last = assessmentUndoStack[assessmentUndoStack.length - 1];
    if (!last) return;

    const config = getSupabaseConfig();
    if (isSupabaseReady(config)) {
      await deleteAssessmentByUserAndImageFromSupabase(last.user_id, last.image_id, config);
    }

    const remaining = assessmentUndoStack.slice(0, -1);
    setAssessmentUndoStack(remaining);
    setLastAssessed(remaining[remaining.length - 1] ?? null);
    await loadAllAssessments();
    if (user) await loadUserAssessments(user.userId);
  };

  const handleUpdateClassification = async (id: string, newClass: FreshnessClass) => {
    const config = getSupabaseConfig();
    if (isSupabaseReady(config)) {
      await updateAssessmentClassificationInSupabase(id, newClass, config);
    }
    setAllAssessments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, classification: newClass } : a))
    );
    if (user) await loadUserAssessments(user.userId);
  };

  const handleDeleteAssessment = async (id: string) => {
    const config = getSupabaseConfig();
    if (isSupabaseReady(config)) {
      await deleteAssessmentFromSupabase(id, config);
    }
    const removed = allAssessments.find((a) => a.id === id);
    setAllAssessments((prev) => prev.filter((a) => a.id !== id));
    setAssessmentUndoStack((prev) => prev.filter((a) => !removed || a.id !== removed.id));
    if (user) await loadUserAssessments(user.userId);
  };

  const handleDeleteAssessmentsBulk = async (ids: string[]) => {
    const config = getSupabaseConfig();
    if (isSupabaseReady(config)) {
      await deleteAssessmentsBulkFromSupabase(ids, config);
    }
    setAllAssessments((prev) => prev.filter((a) => !ids.includes(a.id)));
    setAssessmentUndoStack((prev) => prev.filter((a) => !ids.includes(a.id)));
    if (user) await loadUserAssessments(user.userId);
  };

  // CRUD for Folders
  const handleCreateFolder = (name: string, parentId: string | null, isParent: boolean) => {
    // Check if folder with same name and parent already exists
    const existingFolder = folders.find(
      (f) => f.name.trim().toLowerCase() === name.trim().toLowerCase() && 
             f.parentId === parentId && 
             f.isParent === isParent
    );
    
    if (existingFolder) {
      console.warn(`Folder "${name}" already exists with the same parent. Skipping creation.`);
      return;
    }

    const newFolder: FolderNode = {
      id: (isParent ? 'parent_' : 'sub_') + Math.random().toString(36).substring(2, 9),
      name,
      parentId,
      isParent,
      createdAt: new Date().toISOString(),
    };
    const updated = [...folders, newFolder];
    setFolders(updated);
    saveFolders(updated);
    upsertFoldersToSupabase([newFolder], getSupabaseConfig()).catch((err) =>
      console.warn('Folder push to Supabase failed:', err)
    );
  };

  // Helper function to remove duplicate folders (same name, parent, and type)
  const handleRemoveDuplicateFolders = () => {
    const folderMap = new Map<string, FolderNode>();
    
    folders.forEach(folder => {
      const key = `${folder.name.trim().toLowerCase()}_${folder.parentId}_${folder.isParent}`;
      if (!folderMap.has(key)) {
        folderMap.set(key, folder);
      }
    });
    
    const deduplicatedFolders = Array.from(folderMap.values());
    
    if (deduplicatedFolders.length < folders.length) {
      setFolders(deduplicatedFolders);
      saveFolders(deduplicatedFolders);
      const allIds = folders.map(f => f.id);
      const keptIds = deduplicatedFolders.map(f => f.id);
      const removedIds = allIds.filter(id => !keptIds.includes(id));
      deleteFoldersFromSupabase(removedIds, getSupabaseConfig()).catch((err) =>
        console.warn('Folder delete on Supabase failed:', err)
      );
      console.log(`Removed ${folders.length - deduplicatedFolders.length} duplicate folders`);
    }
  };

  const handleDeleteFolder = (folderId: string) => {
    const folderToDelete = folders.find((f) => f.id === folderId);
    if (!folderToDelete) return;

    // Recursive helper to get all descendant folder IDs
    const getDescendantIds = (id: string): string[] => {
      const children = folders.filter((f) => f.parentId === id);
      return children.reduce((acc, child) => [...acc, child.id, ...getDescendantIds(child.id)], [] as string[]);
    };

    const descendantIds = getDescendantIds(folderId);
    const allRemovedIds = [folderId, ...descendantIds];
    const removedFolderNames = new Set(folders.filter(f => allRemovedIds.includes(f.id)).map(f => f.name));

    const updatedFolders = folders.filter((f) => !allRemovedIds.includes(f.id));
    setFolders(updatedFolders);
    saveFolders(updatedFolders);
    deleteFoldersFromSupabase(allRemovedIds, getSupabaseConfig()).catch((err) =>
      console.warn('Folder delete on Supabase failed:', err)
    );

    const shouldRemove = (item: DatasetItem) =>
      removedFolderNames.has(item.parentFolder) || removedFolderNames.has(item.subFolder);

    const removedItemIds = items.filter(shouldRemove).map((item) => item.id);
    const updatedItems = items.filter((item) => !shouldRemove(item));
    setItems(updatedItems);
    saveDatasetItems(updatedItems);
    removeItemsFromSupabase(removedItemIds);
  };

  // CRUD for Dataset Items
  const handleCreateItem = (itemData: Omit<DatasetItem, 'id' | 'uploadedAt'>) => {
    const newItem: DatasetItem = {
      ...itemData,
      id: 'img_' + Math.random().toString(36).substring(2, 9),
      uploadedAt: new Date().toISOString(),
    };
    const updated = [newItem, ...items];
    setItems(updated);
    saveDatasetItems(updated);
    pushItemsToSupabase([newItem]);
  };

  // Bulk import folders + images in a single atomic update
  const handleBulkImport = (
    newFolders: ImportFolderInput[],
    newItems: Omit<DatasetItem, 'id' | 'uploadedAt'>[]
  ): { createdFolders: number; createdItems: number; error?: string } => {
    const workingFolders = [...folders];
    const folderKeys = new Set(
      workingFolders.map((f) => `${f.parentId ?? 'root'}::${f.name.trim().toLowerCase()}`)
    );
    const firstParentId = workingFolders.find((f) => f.isParent)?.id ?? null;

    const resolveParentId = (name: string | null): string | null => {
      if (!name) return null;
      const match = workingFolders.find(
        (f) => f.isParent && f.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      return match ? match.id : null;
    };

    let createdFolders = 0;
    const addedFolders: FolderNode[] = [];
    const addFolder = (input: ImportFolderInput) => {
      const name = input.name.trim();
      if (!name) return;
      const parentId = input.isParent ? null : resolveParentId(input.parentName) ?? firstParentId;
      const key = `${parentId ?? 'root'}::${name.toLowerCase()}`;
      if (folderKeys.has(key)) return;
      const newFolder: FolderNode = {
        id: (input.isParent ? 'parent_' : 'sub_') + Math.random().toString(36).substring(2, 9),
        name,
        parentId,
        isParent: input.isParent,
        createdAt: new Date().toISOString(),
      };
      workingFolders.push(newFolder);
      addedFolders.push(newFolder);
      folderKeys.add(key);
      createdFolders += 1;
    };

    // Parents are created first so their subfolders can resolve a parent id
    newFolders.filter((f) => f.isParent).forEach(addFolder);
    newFolders.filter((f) => !f.isParent).forEach(addFolder);

    const createdItems: DatasetItem[] = newItems.map((item) => ({
      ...item,
      id: 'img_' + Math.random().toString(36).substring(2, 9),
      uploadedAt: new Date().toISOString(),
    }));
    const updatedItems = [...createdItems, ...items];

    // Image files now live in Supabase Storage, so the local list only holds short public URLs.
    // Persist locally as a best-effort cache and push the dataset rows up to Supabase.
    saveDatasetItems(updatedItems);
    saveFolders(workingFolders);
    setFolders(workingFolders);
    setItems(updatedItems);
    pushItemsToSupabase(createdItems);
    if (addedFolders.length > 0) {
      upsertFoldersToSupabase(addedFolders, getSupabaseConfig()).catch((err) =>
        console.warn('Folder push to Supabase failed:', err)
      );
    }
    return { createdFolders, createdItems: createdItems.length };
  };

  const handleUpdateItem = (id: string, updates: Partial<DatasetItem>) => {
    const updated = items.map((item) => (item.id === id ? { ...item, ...updates } : item));
    setItems(updated);
    saveDatasetItems(updated);
    const changed = updated.find((item) => item.id === id);
    if (changed) pushItemsToSupabase([changed]);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    saveDatasetItems(updated);
    removeItemsFromSupabase([id]);
  };

  // "Restore Sample Dataset" now pushes the sample rows into Supabase, then re-reads from it.
  const handleReloadDefaults = async () => {
    resetDatasetToDefaults();
    const config = getSupabaseConfig();
    if (isSupabaseReady(config)) {
      await Promise.all([
        upsertFoldersToSupabase(DEFAULT_FOLDERS, config),
        upsertDatasetItemsToSupabase(DEFAULT_DATASET_ITEMS, config),
      ]);
    }
    await refreshDatasetFromSupabase();
  };

  const handleSaveSupabase = (config: SupabaseConfig) => {
    saveSupabaseConfig(config);
    setSupabaseConfig(config);
  };

  // Folder filter options derived from the Supabase-backed images the evaluator can see
  // Memoized subfolders list for the folder selector (even when hidden on mobile)
  const subfoldersList = React.useMemo(() => {
    return Array.from(new Set(userItems.map((item) => item.subFolder).filter(Boolean)));
  }, [userItems]);

  const totalUserAssessments = user ? userAssessments.length : 0;

  // ROUTE: /administrator
  if (currentRoute === '/administrator') {
    return (
      <AdminPortal
        folders={folders}
        items={items}
        allAssessments={allAssessments}
        isAssessmentsLoading={isAllAssessmentsLoading}
        assessmentsError={allAssessmentsError}
        onRefreshAssessments={loadAllAssessments}
        supabaseConfig={supabaseConfig}
        onSaveSupabaseConfig={handleSaveSupabase}
        onCreateFolder={handleCreateFolder}
        onDeleteFolder={handleDeleteFolder}
        onCreateItem={handleCreateItem}
        onBulkImport={handleBulkImport}
        onUpdateItem={handleUpdateItem}
        onDeleteItem={handleDeleteItem}
        onDeleteAssessment={handleDeleteAssessment}
        onDeleteAssessmentsBulk={handleDeleteAssessmentsBulk}
        onReloadDefaults={handleReloadDefaults}
        onRemoveDuplicateFolders={handleRemoveDuplicateFolders}
        onExitAdmin={() => navigateTo('/')}
      />
    );
  }

  // DEFAULT ROUTE: USER DATING-APP SWIPE INTERFACE
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-emerald-500 selection:text-white">
      {/* Top Light-Theme Navigation - Hidden on Mobile */}
      <div className="hidden sm:block">
        <Navbar
          currentTab={currentTab}
          onSelectTab={setCurrentTab}
          user={user}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          onOpenHelp={() => setIsHelpOpen(true)}
          onNavigateAdmin={() => navigateTo('/administrator')}
          totalUserAssessments={totalUserAssessments}
        />
      </div>

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col justify-start py-4">
        {currentTab === 'swipe' && (
          <div className="flex-1 flex flex-col items-center justify-center px-4">
            {user ? (
              <DatingCardDeck
                items={filteredUserItems}
                allItems={userItems}
                userAssessments={userAssessments}
                user={user}
                onRecordAssessment={handleRecordAssessment}
                onUndoLastAssessment={handleUndoLastAssessment}
                lastAssessedRecord={lastAssessed}
                onNavigateToHistory={() => setCurrentTab('history')}
                onNavigateToAdmin={() => navigateTo('/administrator')}
                availableFolders={subfoldersList}
                isLoading={isUserItemsLoading}
                errorMessage={userItemsError}
                onRefresh={loadUserItems}
              />
            ) : (
              <div className="text-center py-20">
                <button
                  onClick={() => setIsOnboardingOpen(true)}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 text-white font-extrabold shadow-lg cursor-pointer"
                >
                  Get Started
                </button>
              </div>
            )}
          </div>
        )}

        {currentTab === 'history' && (
          <UserHistory
            assessments={userAssessments}
            isLoading={isHistoryLoading}
            errorMessage={historyError}
            user={
              user || {
                userId: 'anonymous',
                userName: 'Evaluator',
                startedAt: new Date().toISOString(),
                avatarSeed: 'guest',
              }
            }
            onUpdateClassification={handleUpdateClassification}
            onDeleteAssessment={handleDeleteAssessment}
            onNavigateToSwipe={() => setCurrentTab('swipe')}
          />
        )}
      </main>

      {/* Discreet Footer with Administrator link */}
      <footer className="border-t border-slate-200/80 py-4 px-6 bg-white/50 text-center text-xs text-slate-400 flex flex-col sm:flex-row items-center justify-between max-w-7xl mx-auto w-full gap-2">
        <p>FreshMatch AI Dataset Hub • Simple, friendly food freshness assessment.</p>
        <button
          onClick={() => navigateTo('/administrator')}
          className="inline-flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 font-semibold transition-colors cursor-pointer"
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Administrator Portal</span>
        </button>
      </footer>

      {/* Onboarding / Get Started Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        currentUser={user}
        supabaseConfig={supabaseConfig}
        onComplete={(newSession) => {
          setUser(newSession);
          setIsOnboardingOpen(false);
          setCurrentTab('swipe');
        }}
        onClose={user ? () => setIsOnboardingOpen(false) : undefined}
      />

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
