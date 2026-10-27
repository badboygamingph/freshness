import React, { useEffect, useMemo, useRef, useState } from 'react';
import { 
  Folder, 
  FolderPlus, 
  Upload, 
  Image as ImageIcon, 
  Trash2, 
  Edit3, 
  Database, 
  Plus, 
  Check, 
  Copy, 
  RefreshCw, 
  Download, 
  Search, 
  ExternalLink, 
  FolderTree, 
  FileText, 
  ShieldCheck, 
  X, 
  Eye, 
  Heart, 
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  UserCheck,
  Clock,
  Sparkles,
  Filter,
  Archive,
  BarChart3,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  AssessmentRecord, 
  DatasetItem, 
  FolderNode, 
  FreshnessClass, 
  ImportFolderInput, 
  SupabaseConfig,
  UserDatasetSummary
} from '../types/freshness';
import { 
  DEFAULT_PARENT_FOLDER_NAME, 
  exportAssessmentsToCSV, 
  exportAssessmentsToJSON, 
  fetchAllAssessmentsFromSupabase,
  generateSupabaseSQLTable, 
  resetDatasetToDefaults, 
  testSupabaseConnection,
  uploadDatasetImageToSupabase,
  upsertDatasetItemsToSupabase,
  getUserDatasetSummaries
} from '../utils/assessmentStorage';
import { AdminAnalytics } from './AdminAnalytics';

interface AdminDashboardProps {
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
  onRemoveDuplicateFolders?: () => void;
}

type FileWithRelativePath = File & { webkitRelativePath?: string };

interface FolderPlanEntry {
  file: File;
  subFolder: string;
}

interface FolderPlan {
  rootName: string;
  subfolderNames: string[];
  assignments: FolderPlanEntry[];
  directCount: number;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getRelativePath = (file: File): string =>
  (file as FileWithRelativePath).webkitRelativePath || '';

// Walks a dropped directory entry recursively and returns the contained files
const collectEntryFiles = async (entry: any): Promise<File[]> => {
  if (!entry) return [];
  if (entry.isFile) {
    return new Promise((resolve) => {
      entry.file(
        (file: File) => {
          try {
            Object.defineProperty(file, 'webkitRelativePath', {
              value: String(entry.fullPath || '').replace(/^\//, ''),
              configurable: true,
            });
          } catch {
            /* ignore read-only file objects */
          }
          resolve([file]);
        },
        () => resolve([])
      );
    });
  }
  if (entry.isDirectory) {
    const reader = entry.createReader();
    const readBatch = (): Promise<any[]> =>
      new Promise((resolve) => {
        reader.readEntries((entries: any[]) => resolve(entries || []), () => resolve([]));
      });
    const children: any[] = [];
    let batch = await readBatch();
    while (batch.length > 0) {
      children.push(...batch);
      batch = await readBatch();
    }
    const nested = await Promise.all(children.map((child) => collectEntryFiles(child)));
    return nested.flat();
  }
  return [];
};

const collectDroppedFiles = async (dataTransfer: DataTransfer): Promise<File[]> => {
  const items = Array.from(dataTransfer.items || []);
  const entries = items
    .map((item) => (typeof (item as any).webkitGetAsEntry === 'function' ? (item as any).webkitGetAsEntry() : null))
    .filter(Boolean);

  if (entries.length > 0) {
    const nested = await Promise.all(entries.map((entry) => collectEntryFiles(entry)));
    const files = nested.flat();
    if (files.length > 0) return files;
  }
  return Array.from(dataTransfer.files || []);
};

// Derives the folder layout implied by a selection of files picked from a directory
const parseFolderPlan = (files: File[]): FolderPlan => {
  const images = files.filter((f) => f.type.startsWith('image/'));
  let rootName = '';
  const subfolderNames: string[] = [];
  const seen = new Set<string>();
  const assignments: FolderPlanEntry[] = [];
  let directCount = 0;

  for (const file of images) {
    const rel = getRelativePath(file);
    const parts = rel ? rel.split('/').filter(Boolean) : [file.name];
    if (!rootName && parts.length > 1) rootName = parts[0];

    const subFolder = parts.length >= 3 ? parts[parts.length - 2] : '';
    if (subFolder) {
      const key = subFolder.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        subfolderNames.push(subFolder);
      }
    } else {
      directCount += 1;
    }
    assignments.push({ file, subFolder });
  }

  return { rootName, subfolderNames, assignments, directCount };
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  folders,
  items,
  allAssessments,
  isAssessmentsLoading = false,
  assessmentsError = null,
  onRefreshAssessments,
  supabaseConfig,
  onSaveSupabaseConfig,
  onCreateFolder,
  onDeleteFolder,
  onCreateItem,
  onBulkImport,
  onUpdateItem,
  onDeleteItem,
  onDeleteAssessment,
  onDeleteAssessmentsBulk,
  onReloadDefaults,
  onRemoveDuplicateFolders,
}) => {
  const [adminTab, setAdminTab] = useState<'datasets' | 'assessments' | 'analytics' | 'supabase'>('datasets');
  const [selectedFolderKey, setSelectedFolderKey] = useState<string>('fresh'); // subfolder name or 'all'
  const [searchItem, setSearchItem] = useState<string>('');
  const [itemsPage, setItemsPage] = useState<number>(1);
  const itemsPerPage = 12;

  // Modals
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const [isParentFolderCreation, setIsParentFolderCreation] = useState(false);

  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DatasetItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemUrl, setItemUrl] = useState('');
  const [itemDescription, setItemDescription] = useState('');
  const [itemParentFolder, setItemParentFolder] = useState(DEFAULT_PARENT_FOLDER_NAME);
  const [itemSubFolder, setItemSubFolder] = useState('fresh');
  const [itemTags, setItemTags] = useState('');
  const [itemUploading, setItemUploading] = useState(false);
  const [itemUploadError, setItemUploadError] = useState<string | null>(null);
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);

  // Bulk upload modal states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState<'files' | 'folder'>('files');
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkParentFolder, setBulkParentFolder] = useState(DEFAULT_PARENT_FOLDER_NAME);
  const [bulkSubFolder, setBulkSubFolder] = useState('fresh');
  const [bulkRootFolderName, setBulkRootFolderName] = useState('');
  const [bulkDescription, setBulkDescription] = useState('');
  const [bulkTags, setBulkTags] = useState('');
  const [bulkIsDragOver, setBulkIsDragOver] = useState(false);
  const [bulkIsImporting, setBulkIsImporting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const bulkFilesInputRef = useRef<HTMLInputElement>(null);
  const bulkFolderInputRef = useRef<HTMLInputElement>(null);

  // Evaluator dataset states
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState<string | null>(null);
  const [evaluatorCategoryFilter, setEvaluatorCategoryFilter] = useState<'all' | 'fresh' | 'semi-fresh' | 'spoiled'>('all');
  const [evaluatorFolderFilter, setEvaluatorFolderFilter] = useState<string>('all');
  const [evaluatorViewMode, setEvaluatorViewMode] = useState<'evaluators' | 'raw_table'>('evaluators');
  const [createdDatasetNotice, setCreatedDatasetNotice] = useState<string | null>(null);
  const [selectedAssessmentIds, setSelectedAssessmentIds] = useState<Set<string>>(new Set());
  const [isZipExporting, setIsZipExporting] = useState(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number } | null>(null);

  // Supabase states
  const [dbUrl, setDbUrl] = useState(supabaseConfig.url || '');
  const [dbKey, setDbKey] = useState(supabaseConfig.anonKey || '');
  const [dbTable, setDbTable] = useState(supabaseConfig.tableName || 'freshness_assessments');
  const [dbAutoSync, setDbAutoSync] = useState(supabaseConfig.autoSync || false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionSuccess, setConnectionSuccess] = useState<boolean | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);

  // File Upload handling — image bytes go to Supabase Storage, only the public URL is kept
  const getActiveSupabaseConfig = (): SupabaseConfig => ({
    url: dbUrl.trim() || supabaseConfig.url,
    anonKey: dbKey.trim() || supabaseConfig.anonKey,
    tableName: dbTable.trim() || 'freshness_assessments',
    autoSync: dbAutoSync,
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setItemUploading(true);
    setItemUploadError(null);
    const result = await uploadDatasetImageToSupabase(file, getActiveSupabaseConfig());
    setItemUploading(false);

    if (result.error || !result.publicUrl) {
      setItemUploadError(result.error || 'Failed to upload the image to Supabase.');
      return;
    }
    setItemUrl(result.publicUrl);
    if (!itemName) {
      setItemName(file.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // Open Create Item Modal
  const handleOpenCreateItem = () => {
    setEditingItem(null);
    setItemName('');
    setItemUrl('');
    setItemDescription('');
    setItemParentFolder(DEFAULT_PARENT_FOLDER_NAME);
    setItemSubFolder(selectedFolderKey !== 'all' ? selectedFolderKey : 'fresh');
    setItemTags('');
    setItemUploadError(null);
    setIsItemModalOpen(true);
  };

  // Open Edit Item Modal
  const handleOpenEditItem = (item: DatasetItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemUrl(item.imageUrl);
    setItemDescription(item.description || '');
    setItemParentFolder(item.parentFolder);
    setItemSubFolder(item.subFolder);
    setItemTags(item.tags ? item.tags.join(', ') : '');
    setItemUploadError(null);
    setIsItemModalOpen(true);
  };

  // Submit Item Create / Edit
  const handleSubmitItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim() || !itemUrl.trim()) return;

    const parsedTags = itemTags
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);

    if (editingItem) {
      onUpdateItem(editingItem.id, {
        name: itemName.trim(),
        imageUrl: itemUrl.trim(),
        description: itemDescription.trim(),
        parentFolder: itemParentFolder,
        subFolder: itemSubFolder,
        tags: parsedTags,
      });
    } else {
      onCreateItem({
        name: itemName.trim(),
        imageUrl: itemUrl.trim(),
        description: itemDescription.trim(),
        parentFolder: itemParentFolder,
        subFolder: itemSubFolder,
        tags: parsedTags,
        fileSize: '450 KB',
      });
    }

    setIsItemModalOpen(false);
  };

  // Submit Folder Creation
  const handleSubmitFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    onCreateFolder(newFolderName.trim(), newFolderParentId, isParentFolderCreation);
    setNewFolderName('');
    setIsFolderModalOpen(false);
  };

  // ---- Bulk upload: multiple images or a whole folder ----
  const folderPlan = useMemo(
    () => (bulkMode === 'folder' ? parseFolderPlan(bulkFiles) : null),
    [bulkMode, bulkFiles]
  );

  const bulkImageCount = bulkFiles.filter((f) => f.type.startsWith('image/')).length;
  const bulkTotalBytes = bulkFiles.reduce((sum, f) => sum + f.size, 0);

  const resetBulkState = () => {
    setBulkFiles([]);
    setBulkRootFolderName('');
    setBulkDescription('');
    setBulkTags('');
    setBulkProgress(null);
    setBulkNotice(null);
    setBulkError(null);
  };

  const handleOpenBulkModal = (mode: 'files' | 'folder') => {
    resetBulkState();
    setBulkMode(mode);
    setBulkParentFolder(DEFAULT_PARENT_FOLDER_NAME);
    setBulkSubFolder(selectedFolderKey !== 'all' ? selectedFolderKey : 'fresh');
    setIsBulkModalOpen(true);
  };

  const appendBulkFiles = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      setBulkError('No image files were found in that selection.');
      return;
    }
    setBulkError(null);
    setBulkNotice(null);
    setBulkFiles((prev) => [...prev, ...images]);
  };

  const handleBulkFilesPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    appendBulkFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };

  const handleBulkFolderPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const plan = parseFolderPlan(picked);
    if (plan.rootName && !bulkRootFolderName.trim()) {
      setBulkRootFolderName(plan.rootName);
    }
    appendBulkFiles(picked);
    e.target.value = '';
  };

  const handleBulkDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setBulkIsDragOver(false);
    const dropped = await collectDroppedFiles(e.dataTransfer);
    if (dropped.some((f) => getRelativePath(f))) {
      setBulkMode('folder');
      setBulkRootFolderName((prev) => prev || parseFolderPlan(dropped).rootName);
    }
    appendBulkFiles(dropped);
  };

  const handleRunBulkImport = async () => {
    if (bulkImageCount === 0) {
      setBulkError('Select at least one image before importing.');
      return;
    }

    setBulkIsImporting(true);
    setBulkError(null);
    setBulkNotice(null);

    try {
      const parsedTags = bulkTags.split(',').map((t) => t.trim()).filter(Boolean);
      const plannedFolders: ImportFolderInput[] = [];
      const plannedItems: Omit<DatasetItem, 'id' | 'uploadedAt'>[] = [];
      const config = getActiveSupabaseConfig();

      // Uploads one image file to Supabase Storage and returns its public URL
      const uploadFile = async (file: File, folderPath: string): Promise<string> => {
        const uploaded = await uploadDatasetImageToSupabase(file, config, folderPath);
        if (uploaded.error || !uploaded.publicUrl) {
          throw new Error(
            `Failed to upload "${file.name}" to Supabase: ${uploaded.error || 'unknown error'}`
          );
        }
        return uploaded.publicUrl;
      };

      if (bulkMode === 'folder' && folderPlan) {
        const parentName = bulkRootFolderName.trim() || folderPlan.rootName || DEFAULT_PARENT_FOLDER_NAME;
        plannedFolders.push({ name: parentName, parentName: null, isParent: true });
        folderPlan.subfolderNames.forEach((name) =>
          plannedFolders.push({ name, parentName, isParent: false })
        );
        if (folderPlan.directCount > 0) {
          plannedFolders.push({ name: bulkSubFolder, parentName, isParent: false });
        }

        let done = 0;
        setBulkProgress({ done, total: folderPlan.assignments.length });
        for (const entry of folderPlan.assignments) {
          const subFolder = entry.subFolder || bulkSubFolder;
          const imageUrl = await uploadFile(entry.file, `${parentName}/${subFolder}`);
          plannedItems.push({
            name: entry.file.name.replace(/\.[^/.]+$/, ''),
            imageUrl,
            description: bulkDescription.trim(),
            parentFolder: parentName,
            subFolder,
            tags: parsedTags,
            fileSize: formatFileSize(entry.file.size),
          });
          done += 1;
          setBulkProgress({ done, total: folderPlan.assignments.length });
        }
      } else {
        const images = bulkFiles.filter((f) => f.type.startsWith('image/'));
        let done = 0;
        setBulkProgress({ done, total: images.length });
        for (const file of images) {
          const imageUrl = await uploadFile(file, `${bulkParentFolder}/${bulkSubFolder}`);
          plannedItems.push({
            name: file.name.replace(/\.[^/.]+$/, ''),
            imageUrl,
            description: bulkDescription.trim(),
            parentFolder: bulkParentFolder,
            subFolder: bulkSubFolder,
            tags: parsedTags,
            fileSize: formatFileSize(file.size),
          });
          done += 1;
          setBulkProgress({ done, total: images.length });
        }
      }

      const result = onBulkImport(plannedFolders, plannedItems);
      if (result.error) {
        setBulkError(result.error);
      } else {
        const folderNote =
          result.createdFolders > 0
            ? ` Created ${result.createdFolders} folder${result.createdFolders === 1 ? '' : 's'}.`
            : '';
        setBulkNotice(
          `Imported ${result.createdItems} image${result.createdItems === 1 ? '' : 's'}.${folderNote}`
        );
        setBulkFiles([]);
        setBulkRootFolderName('');
      }
    } catch (err: any) {
      setBulkError(err?.message || 'Failed to read the selected images.');
    } finally {
      setBulkIsImporting(false);
      setBulkProgress(null);
    }
  };

  // Supabase save & test
  const handleSaveAndTestSupabase = async () => {
    const updated: SupabaseConfig = {
      url: dbUrl.trim(),
      anonKey: dbKey.trim(),
      tableName: dbTable.trim() || 'freshness_assessments',
      autoSync: dbAutoSync,
    };
    onSaveSupabaseConfig(updated);

    if (!updated.url || !updated.anonKey) {
      setConnectionSuccess(false);
      setConnectionMessage('Please provide both Supabase URL and Anon Key.');
      return;
    }

    setTestingConnection(true);
    setConnectionMessage(null);
    const result = await testSupabaseConnection(updated);
    setTestingConnection(false);
    setConnectionSuccess(result.success);
    setConnectionMessage(result.message);
  };

  const handleSyncNow = async () => {
    setTestingConnection(true);
    let count = allAssessments.length;
    let error: string | undefined;
    if (onRefreshAssessments) {
      const result = await onRefreshAssessments();
      count = result.count;
      error = result.error;
    } else {
      const result = await fetchAllAssessmentsFromSupabase(getActiveSupabaseConfig());
      count = result.records.length;
      error = result.error;
    }
    setTestingConnection(false);
    if (error) {
      setConnectionSuccess(false);
      setConnectionMessage(`Reload failed: ${error}`);
    } else {
      setConnectionSuccess(true);
      setConnectionMessage(`Loaded ${count} evaluator assessments from Supabase.`);
    }
  };

  const handlePushDatasetImages = async () => {
    const config: SupabaseConfig = {
      url: dbUrl.trim(),
      anonKey: dbKey.trim(),
      tableName: dbTable.trim() || 'freshness_assessments',
      autoSync: dbAutoSync,
    };
    setTestingConnection(true);
    const result = await upsertDatasetItemsToSupabase(items, config);
    setTestingConnection(true); // Keep spinner active during the count update
    // Force a small delay to ensure Supabase has processed the batch
    await new Promise(r => setTimeout(r, 800));
    setTestingConnection(false);
    if (result.error) {
      setConnectionSuccess(false);
      setConnectionMessage(`Image upload to Supabase failed: ${result.error}`);
    } else {
      setConnectionSuccess(true);
      setConnectionMessage(
        `Uploaded ${result.count} dataset image${result.count === 1 ? '' : 's'} to Supabase (table "dataset_items"). Evaluators will now see them.`
      );
    }
  };

  const handleExportZIP = async (recs: AssessmentRecord[], filename: string) => {
    if (recs.length === 0) return;
    
    setIsZipExporting(true);
    setZipProgress({ done: 0, total: recs.length });
    
    const zip = new JSZip();
    const userSummaries = getUserDatasetSummaries(allAssessments, items.length);
    
    try {
      for (let i = 0; i < recs.length; i++) {
        const rec = recs[i];
        const userMatch = userSummaries.find((u) => u.userId === rec.user_id);
        const evaluatorNum = userMatch ? userMatch.evaluatorNumber : 'Unknown';
        
        // Structure: Evaluator_N / Classification / ParentFolder / SubFolder / Name.ext
        const classification = rec.classification.toUpperCase();
        const parent = rec.parent_folder || 'Uncategorized';
        const sub = rec.sub_folder || 'Root';
        
        const folderPath = `Evaluator_${evaluatorNum}/${classification}/${parent}/${sub}`;
        
        try {
          const response = await fetch(rec.image_url);
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          const blob = await response.blob();
          
          // Try to preserve original extension or use jpg
          const ext = rec.image_url.split('.').pop()?.split('?')[0] || 'jpg';
          const name = rec.image_name.endsWith(`.${ext}`) ? rec.image_name : `${rec.image_name}.${ext}`;
          
          zip.file(`${folderPath}/${name}`, blob);
        } catch (err) {
          console.error(`Failed to download image: ${rec.image_url}`, err);
          // Add a text file noting the failure instead of failing the whole ZIP
          zip.file(`${folderPath}/${rec.image_name}_FAILED_TO_DOWNLOAD.txt`, `URL: ${rec.image_url}\nError: ${err}`);
        }
        
        setZipProgress({ done: i + 1, total: recs.length });
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, filename);
    } catch (err: any) {
      alert(`ZIP export failed: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsZipExporting(false);
      setZipProgress(null);
    }
  };

  const handleCopySQL = () => {
    const sql = generateSupabaseSQLTable(dbTable.trim() || 'freshness_assessments');
    navigator.clipboard.writeText(sql);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  // Filtered dataset items
  const parentFolders = folders.filter((f) => f.isParent);
  const subFolders = folders.filter((f) => !f.isParent);

  const displayItems = items.filter((item) => {
    const matchesFolder = selectedFolderKey === 'all' || item.subFolder === selectedFolderKey;
    const matchesSearch = item.name.toLowerCase().includes(searchItem.toLowerCase()) ||
      item.subFolder.toLowerCase().includes(searchItem.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  // Reset to page 1 when filter changes
  useEffect(() => {
    setItemsPage(1);
  }, [selectedFolderKey, searchItem]);

  return (
    <div className="w-full max-w-6xl mx-auto py-4 sm:py-6 px-3 sm:px-6">
      {/* ZIP Export Progress Overlay */}
      {isZipExporting && zipProgress && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border border-indigo-100 animate-in fade-in zoom-in duration-300">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">Generating Dataset ZIP...</h3>
            <p className="text-sm text-slate-500 mb-6">
              Downloading {zipProgress.total} images and organizing them into classified folders. This may take a moment depending on your connection.
            </p>
            
            <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden mb-2 border border-slate-200">
              <div 
                className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all duration-300"
                style={{ width: `${(zipProgress.done / zipProgress.total) * 100}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs font-bold text-slate-500">
              <span>{zipProgress.done} / {zipProgress.total} Images</span>
              <span>{Math.round((zipProgress.done / zipProgress.total) * 100)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              Admin Studio
            </span>
            <span className="text-xs text-slate-500">
              {adminTab === 'datasets' && 'Dataset Hierarchy & File Management'}
              {adminTab === 'assessments' && 'Evaluator Performance & Quality Monitoring'}
              {adminTab === 'analytics' && 'Real-time Analytics & Insights'}
              {adminTab === 'supabase' && 'Database Configuration & Sync'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {adminTab === 'datasets' && 'Dataset Management Dashboard'}
            {adminTab === 'assessments' && 'Evaluator Datasets Monitor'}
            {adminTab === 'analytics' && 'Analytics Dashboard'}
            {adminTab === 'supabase' && 'Supabase Configuration'}
          </h2>
          <p className="text-xs text-slate-500">
            {adminTab === 'datasets' && 'Create folders, subfolders, upload images, manage CRUD datasets, and review multi-user labels.'}
            {adminTab === 'assessments' && 'Monitor individual evaluator progress, compare classifications, and convert their work into training dataset folders.'}
            {adminTab === 'analytics' && 'View real-time insights into evaluator performance, classification trends, and activity patterns.'}
            {adminTab === 'supabase' && 'Configure Supabase connection, sync data, and manage database tables.'}
          </p>
        </div>

        {/* Admin Navigation Pills - Responsive Scroll/Wrap */}
        <div className="flex items-center gap-1 sm:gap-1.5 p-1 bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-x-auto max-w-full shrink-0">
          <button
            onClick={() => setAdminTab('datasets')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              adminTab === 'datasets'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Folders & Files ({items.length})</span>
            <span className="sm:hidden">Files ({items.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('assessments')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              adminTab === 'assessments'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Evaluator Datasets ({allAssessments.length})</span>
            <span className="sm:hidden">Evaluators ({allAssessments.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('analytics')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              adminTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Analytics</span>
            <span className="sm:hidden">Analytics</span>
          </button>

          <button
            onClick={() => setAdminTab('supabase')}
            className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              adminTab === 'supabase'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">Supabase Single-Table</span>
            <span className="sm:hidden">Supabase</span>
          </button>
        </div>
      </div>

      {/* TAB 1: DATASETS & FILES CRUD */}
      {adminTab === 'datasets' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column: Folders & Subfolders Tree */}
          <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                  <Folder className="w-4 h-4 text-indigo-600" />
                  <span>Folders</span>
                </h3>
                <button
                  onClick={() => {
                    setIsParentFolderCreation(false);
                    setNewFolderParentId(parentFolders[0]?.id || null);
                    setIsFolderModalOpen(true);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1"
                  title="Add new subfolder"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Subfolder</span>
                </button>
              </div>

              {/* Folder list */}
              <div className="space-y-3">
                <button
                  onClick={() => setSelectedFolderKey('all')}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between transition-colors ${
                    selectedFolderKey === 'all'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                      : 'hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5" />
                    All Images
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {items.length}
                  </span>
                </button>

                {/* Recursive Folder Tree */}
                {(() => {
                  const renderFolderTree = (parentId: string | null, depth = 0) => {
                    const currentLevelFolders = folders.filter(f => f.parentId === parentId);
                    
                    return currentLevelFolders.map(folder => {
                      const children = folders.filter(f => f.parentId === folder.id);
                      const count = items.filter(i => i.subFolder === folder.name || i.parentFolder === folder.name).length;
                      
                      const isFreshSub = folder.name === 'fresh';
                      const isSemiSub = folder.name === 'semi-fresh';
                      const isSpoiledSub = folder.name === 'spoiled';
                      
                      return (
                        <div key={folder.id} className={`${depth > 0 ? 'ml-3 pl-2 border-l border-slate-100' : 'pt-2 border-t border-slate-100'}`}>
                          <div
                            className={`group flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                              selectedFolderKey === folder.name
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'hover:bg-slate-100 text-slate-700'
                            }`}
                            onClick={() => setSelectedFolderKey(folder.name)}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {isFreshSub && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                              {isSemiSub && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                              {isSpoiledSub && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                              {!isFreshSub && !isSemiSub && !isSpoiledSub && (
                                <Folder className={`w-3 h-3 ${selectedFolderKey === folder.name ? 'text-white/70' : 'text-slate-400'}`} />
                              )}
                              <span className="truncate">{folder.name}</span>
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                                  selectedFolderKey === folder.name
                                    ? 'bg-white/20 text-white'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {count}
                              </span>
                              {!['fresh', 'semi-fresh', 'spoiled'].includes(folder.name) && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsParentFolderCreation(false);
                                      setNewFolderParentId(folder.id);
                                      setIsFolderModalOpen(true);
                                    }}
                                    className="text-indigo-500 hover:text-indigo-700 p-0.5"
                                    title="Add subfolder"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Delete folder "${folder.name}" and all its contents?`)) {
                                        onDeleteFolder(folder.id);
                                      }
                                    }}
                                    className="text-rose-500 hover:text-rose-700 p-0.5"
                                    title="Delete folder"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                          {children.length > 0 && renderFolderTree(folder.id, depth + 1)}
                        </div>
                      );
                    });
                  };
                  return renderFolderTree(null);
                })()}
              </div>
            </div>

            {/* Bottom Actions: Add parent or restore defaults */}
            <div className="pt-4 border-t border-slate-100 mt-6 space-y-2">
              <button
                onClick={() => {
                  setIsParentFolderCreation(true);
                  setNewFolderParentId(null);
                  setIsFolderModalOpen(true);
                }}
                className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <FolderPlus className="w-3.5 h-3.5 text-indigo-600" />
                <span>New Parent Folder</span>
              </button>

              {onRemoveDuplicateFolders && (
                <button
                  onClick={() => {
                    if (confirm('Remove all duplicate folders (same name, parent, and type)? This cannot be undone.')) {
                      onRemoveDuplicateFolders();
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl border border-amber-200 hover:bg-amber-50 text-amber-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-amber-600" />
                  <span>Remove Duplicate Folders</span>
                </button>
              )}

              <button
                onClick={() => {
                  if (confirm('Reset dataset to default Freshness Assessment samples?')) {
                    onReloadDefaults();
                  }
                }}
                className="w-full py-1.5 px-3 rounded-xl text-slate-400 hover:text-slate-600 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restore Sample Dataset</span>
              </button>
            </div>
          </div>

          {/* Right Column: Files & Images Explorer */}
          <div className="lg:col-span-3 space-y-4">
            {/* Action Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search images in folder..."
                    value={searchItem}
                    onChange={(e) => setSearchItem(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <span className="text-xs font-bold text-slate-500 whitespace-nowrap">
                  Folder: <span className="text-indigo-600 font-mono">{selectedFolderKey}</span>
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  onClick={() => handleOpenBulkModal('files')}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Bulk Upload</span>
                </button>
                <button
                  onClick={handleOpenCreateItem}
                  className="w-full sm:w-auto justify-center px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Image / File</span>
                </button>
              </div>
            </div>

            {/* Images Grid with Pagination */}
            {displayItems.length > 0 ? (
              <>
                <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
                  {displayItems
                    .slice((itemsPage - 1) * itemsPerPage, itemsPage * itemsPerPage)
                    .map((item) => (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-44 bg-slate-100 overflow-hidden">
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => setPreviewModalImage(item.imageUrl)}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                          title="Preview full image"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <div className="absolute bottom-2 left-2">
                          <span className="px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-mono">
                            {item.subFolder}
                          </span>
                        </div>
                      </div>

                      <div className="p-3.5">
                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                          {item.description || 'No description provided.'}
                        </p>
                      </div>
                    </div>

                    {/* CRUD Actions */}
                    <div className="px-3.5 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] font-mono text-slate-400">
                        {item.fileSize || 'Image'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditItem(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                          title="Edit item"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Delete "${item.name}" from dataset?`)) {
                              onDeleteItem(item.id);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {displayItems.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-200">
                  <div className="text-xs text-slate-500">
                    Showing {((itemsPage - 1) * itemsPerPage) + 1} to {Math.min(itemsPage * itemsPerPage, displayItems.length)} of {displayItems.length} images
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setItemsPage(Math.max(1, itemsPage - 1))}
                      disabled={itemsPage === 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Previous</span>
                    </button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(displayItems.length / itemsPerPage) }, (_, i) => i + 1)
                        .filter(page => page === 1 || page === Math.ceil(displayItems.length / itemsPerPage) || Math.abs(page - itemsPage) <= 1)
                        .map((page, index, array) => (
                          <React.Fragment key={page}>
                            {index > 0 && array[index - 1] !== page - 1 && (
                              <span className="text-slate-400 px-1">...</span>
                            )}
                            <button
                              onClick={() => setItemsPage(page)}
                              className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                itemsPage === page
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        ))}
                    </div>
                    <button
                      onClick={() => setItemsPage(Math.min(Math.ceil(displayItems.length / itemsPerPage), itemsPage + 1))}
                      disabled={itemsPage === Math.ceil(displayItems.length / itemsPerPage)}
                      className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </>
            ) : (
              <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs">
                <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-800">No images in this folder</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                  Add images to this folder using the "Add Image / File" button above.
                </p>
                <button
                  onClick={handleOpenCreateItem}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-xs inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: PER-USER EVALUATOR DATASETS MONITOR & CRUD CREATOR */}
      {adminTab === 'assessments' && (() => {
        const userSummaries = getUserDatasetSummaries(allAssessments, items.length);
        const currentSummary = userSummaries.find((s) => s.userId === selectedEvaluatorId) || userSummaries[0] || null;

        const handleCreateFolderFromUserDataset = (summary: UserDatasetSummary) => {
          const parentTitle = `EVALUATOR ${summary.evaluatorNumber} DATASET`;
          
          // 1. Create parent folder
          onCreateFolder(parentTitle, null, true);

          // 2. Create subfolders fresh, semi-fresh, spoiled under the parent folder
          setTimeout(() => {
            // Find the parent folder that was just created
            const parentFolder = folders.find(f => f.name === parentTitle && f.isParent);
            const parentId = parentFolder ? parentFolder.id : null;
            
            onCreateFolder('fresh', parentId, false);
            onCreateFolder('semi-fresh', parentId, false);
            onCreateFolder('spoiled', parentId, false);
          }, 50);

          // 3. Clone all user items into this dataset
          const allUserItems = [
            ...summary.freshRecords,
            ...summary.semiFreshRecords,
            ...summary.spoiledRecords,
          ];

          allUserItems.forEach((rec) => {
            onCreateItem({
              name: `${rec.image_name} (Evaluated by User ${summary.evaluatorNumber})`,
              parentFolder: parentTitle,
              subFolder: rec.classification,
              imageUrl: rec.image_url,
              description: rec.notes || `Labeled as ${rec.classification.toUpperCase()} by Evaluator ${summary.evaluatorNumber}`,
              fileSize: '430 KB',
              tags: [`evaluator-${summary.evaluatorNumber}`, rec.classification],
            });
          });

          setCreatedDatasetNotice(`Successfully generated dataset folder "${parentTitle}" containing ${allUserItems.length} classified items!`);
          setTimeout(() => setCreatedDatasetNotice(null), 6000);
        };

        // Source folder path each image originally came from (parent / sub), e.g. "day 1 with karaw / 1 hour"
        const folderPathOf = (rec: AssessmentRecord) =>
          [rec.parent_folder, rec.sub_folder].filter(Boolean).join(' / ');

        const currentRecordFolders = currentSummary
          ? Array.from(
              new Set(
                [
                  ...currentSummary.freshRecords,
                  ...currentSummary.semiFreshRecords,
                  ...currentSummary.spoiledRecords,
                ]
                  .map((rec) => folderPathOf(rec))
                  .filter(Boolean)
              )
            )
          : [];

        const recordsToDisplay = (
          currentSummary
            ? evaluatorCategoryFilter === 'all'
              ? [...currentSummary.freshRecords, ...currentSummary.semiFreshRecords, ...currentSummary.spoiledRecords]
              : evaluatorCategoryFilter === 'fresh'
              ? currentSummary.freshRecords
              : evaluatorCategoryFilter === 'semi-fresh'
              ? currentSummary.semiFreshRecords
              : currentSummary.spoiledRecords
            : []
        ).filter((rec) => evaluatorFolderFilter === 'all' || folderPathOf(rec) === evaluatorFolderFilter);

        return (
          <div className="space-y-6">
            {assessmentsError && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 shadow-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>Could not load evaluator assessments from Supabase: {assessmentsError}</span>
              </div>
            )}

            {isAssessmentsLoading && (
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-2 shadow-xs">
                <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-indigo-600" />
                <span>Loading evaluator assessments from Supabase...</span>
              </div>
            )}

            {/* Notification banner if a dataset folder was just created */}
            {createdDatasetNotice && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{createdDatasetNotice}</span>
                </div>
                <button
                  onClick={() => setAdminTab('datasets')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold"
                >
                  View in Folders & Files →
                </button>
              </div>
            )}

            {/* Header & View Mode Switcher */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Evaluator Quality Monitor
                    </span>
                    <span className="text-xs text-slate-500">
                      {userSummaries.length} Total Evaluator{userSummaries.length === 1 ? '' : 's'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900 mt-1">
                    Multi-User Freshness Datasets
                  </h3>
                  <p className="text-xs text-slate-500">
                    Monitor individual evaluator progress, compare classifications (fresh, semi-fresh, spoiled), and convert their work into training dataset folders.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Mode switcher: Evaluator cards vs Raw table */}
                  <div className="p-1 bg-slate-100 rounded-xl border border-slate-200 flex items-center">
                    <button
                      onClick={() => setEvaluatorViewMode('evaluators')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        evaluatorViewMode === 'evaluators'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Evaluator Datasets
                    </button>
                    <button
                      onClick={() => setEvaluatorViewMode('raw_table')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        evaluatorViewMode === 'raw_table'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Audit Table
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      const csv = exportAssessmentsToCSV(allAssessments);
                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                      const url = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.download = `all_evaluators_freshness_dataset_${new Date().toISOString().slice(0, 10)}.csv`;
                      link.click();
                    }}
                    disabled={allAssessments.length === 0}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>

                  <button
                    onClick={() => {
                      handleExportZIP(allAssessments, `full_freshness_dataset_${new Date().toISOString().slice(0, 10)}.zip`);
                    }}
                    disabled={allAssessments.length === 0 || isZipExporting}
                    className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors flex items-center gap-1.5 disabled:opacity-40 cursor-pointer border border-indigo-200"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Export ZIP</span>
                  </button>

                  {selectedAssessmentIds.size > 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${selectedAssessmentIds.size} selected assessments?`)) {
                          onDeleteAssessmentsBulk(Array.from(selectedAssessmentIds));
                          setSelectedAssessmentIds(new Set());
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1.5 border border-rose-200 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Selected ({selectedAssessmentIds.size})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Evaluators Selection List */}
              {userSummaries.length > 0 ? (
                <div className="pt-5">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                    Active Evaluators:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {userSummaries.map((summary) => {
                      const isSelected = (currentSummary?.userId === summary.userId);
                      return (
                        <div
                          key={summary.userId}
                          onClick={() => {
                            setSelectedEvaluatorId(summary.userId);
                            setEvaluatorCategoryFilter('all');
                            setEvaluatorFolderFilter('all');
                          }}
                          className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
                                U{summary.evaluatorNumber}
                              </div>
                              <span className="text-sm font-extrabold text-slate-900">
                                Evaluator {summary.evaluatorNumber}
                              </span>
                            </div>

                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                summary.isCompleted
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {summary.isCompleted ? 'Completed' : `${summary.totalAssessed}/${items.length} Labeled`}
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden my-2.5">
                            <div
                              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all"
                              style={{ width: `${summary.completionRate}%` }}
                            />
                          </div>

                          {/* Metric pills */}
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-500">
                            <span className="flex items-center gap-1 font-semibold text-emerald-700">
                              <Heart className="w-3 h-3 fill-emerald-500" />
                              {summary.freshRecords.length} Fresh
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-amber-700">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                              {summary.semiFreshRecords.length} Semi
                            </span>
                            <span className="flex items-center gap-1 font-semibold text-rose-700">
                              <X className="w-3 h-3 text-rose-500" />
                              {summary.spoiledRecords.length} Spoiled
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center">
                  <UserCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-sm font-bold text-slate-800">No Evaluators Active Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When users start swiping and evaluating images in the dating-app card interface, each evaluator will automatically generate their own dataset here for easy monitoring.
                  </p>
                </div>
              )}
            </div>

            {/* DETAILED EVALUATOR DATASET VIEW */}
            {evaluatorViewMode === 'evaluators' && currentSummary && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                {/* Evaluator Header Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        Evaluator {currentSummary.evaluatorNumber}'s Dataset
                      </span>
                      {currentSummary.isCompleted && (
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Done
                        </span>
                      )}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mt-1">
                      Freshness Assessment by Evaluator {currentSummary.evaluatorNumber}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Total Classified: <strong>{currentSummary.totalAssessed} items</strong> ({currentSummary.completionRate}% of entire catalog).
                    </p>
                  </div>

                  {/* Actions for this specific evaluator dataset */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCreateFolderFromUserDataset(currentSummary)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Create a new folder in dataset tree from this user's work"
                    >
                      <FolderPlus className="w-3.5 h-3.5" />
                      <span>Create Folder from Evaluator {currentSummary.evaluatorNumber}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const allRecs = [
                          ...currentSummary.freshRecords,
                          ...currentSummary.semiFreshRecords,
                          ...currentSummary.spoiledRecords,
                        ];
                        const csv = exportAssessmentsToCSV(allRecs);
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `evaluator_${currentSummary.evaluatorNumber}_freshness_dataset.csv`;
                        link.click();
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const allRecs = [
                          ...currentSummary.freshRecords,
                          ...currentSummary.semiFreshRecords,
                          ...currentSummary.spoiledRecords,
                        ];
                        handleExportZIP(allRecs, `evaluator_${currentSummary.evaluatorNumber}_freshness_dataset.zip`);
                      }}
                      disabled={isZipExporting}
                      className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-indigo-200"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Export ZIP</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const allRecs = [
                          ...currentSummary.freshRecords,
                          ...currentSummary.semiFreshRecords,
                          ...currentSummary.spoiledRecords,
                        ];
                        if (confirm(`Delete all ${allRecs.length} assessments for Evaluator ${currentSummary.evaluatorNumber}?`)) {
                          onDeleteAssessmentsBulk(allRecs.map(r => r.id));
                        }
                      }}
                      className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-rose-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Evaluator Data</span>
                    </button>
                  </div>
                </div>

                {/* Classification Filter Tabs: Fresh, Semi-Fresh, Spoiled */}
                <div className="flex items-center gap-1.5 sm:gap-2 mb-6 p-1 bg-slate-100 rounded-2xl w-full sm:w-fit overflow-x-auto max-w-full shrink-0">
                  <button
                    onClick={() => setEvaluatorCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                      evaluatorCategoryFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    All Classified ({currentSummary.totalAssessed})
                  </button>

                  <button
                    onClick={() => setEvaluatorCategoryFilter('fresh')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                      evaluatorCategoryFilter === 'fresh'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    <span>Fresh ({currentSummary.freshRecords.length})</span>
                  </button>

                  <button
                    onClick={() => setEvaluatorCategoryFilter('semi-fresh')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                      evaluatorCategoryFilter === 'semi-fresh'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 stroke-[2.5]" />
                    <span>Semi-Fresh ({currentSummary.semiFreshRecords.length})</span>
                  </button>

                  <button
                    onClick={() => setEvaluatorCategoryFilter('spoiled')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 ${
                      evaluatorCategoryFilter === 'spoiled'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <X className="w-3 h-3 stroke-[3]" />
                    <span>Spoiled ({currentSummary.spoiledRecords.length})</span>
                  </button>
                </div>

                {/* Source folder filter: shows which parent folder / subfolder the evaluated images came from */}
                {currentRecordFolders.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 mb-6">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Folder className="w-3.5 h-3.5 text-indigo-500" />
                      Source Folder:
                    </span>
                    <button
                      type="button"
                      onClick={() => setEvaluatorFolderFilter('all')}
                      className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-colors border ${
                        evaluatorFolderFilter === 'all'
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      All Folders
                    </button>
                    {currentRecordFolders.map((folderPath) => {
                      const count = [
                        ...currentSummary.freshRecords,
                        ...currentSummary.semiFreshRecords,
                        ...currentSummary.spoiledRecords,
                      ].filter((rec) => folderPathOf(rec) === folderPath).length;
                      return (
                        <button
                          key={folderPath}
                          type="button"
                          onClick={() => setEvaluatorFolderFilter(folderPath)}
                          className={`px-3 py-1 rounded-xl text-[11px] font-bold transition-colors border flex items-center gap-1 ${
                            evaluatorFolderFilter === folderPath
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                          }`}
                          title={folderPath}
                        >
                          <span className="max-w-[180px] truncate">{folderPath}</span>
                          <span
                            className={`text-[10px] px-1.5 rounded-full ${
                              evaluatorFolderFilter === folderPath
                                ? 'bg-white/25 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Image Gallery of what User evaluated */}
                {recordsToDisplay.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {recordsToDisplay.map((rec: AssessmentRecord) => {
                      const isFresh = rec.classification === 'fresh';
                      const isSemi = rec.classification === 'semi-fresh';
                      const isSpoiled = rec.classification === 'spoiled';

                      return (
                        <div
                          key={rec.id}
                          className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between"
                        >
                          <div>
                            <div className="relative h-40 bg-slate-100 overflow-hidden">
                              <img
                                src={rec.image_url}
                                alt={rec.image_name}
                                className="w-full h-full object-cover"
                              />

                              <div className="absolute top-2 right-2">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase flex items-center gap-1 shadow-xs ${
                                    isFresh
                                      ? 'bg-emerald-600 text-white'
                                      : isSemi
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-rose-600 text-white'
                                  }`}
                                >
                                  {isFresh && <Heart className="w-2.5 h-2.5 fill-current" />}
                                  {isSemi && <AlertTriangle className="w-2.5 h-2.5" />}
                                  {isSpoiled && <X className="w-2.5 h-2.5 stroke-[3]" />}
                                  {rec.classification}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => setPreviewModalImage(rec.image_url)}
                                className="absolute bottom-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                                title="Zoom image"
                              >
                                <Eye className="w-3 h-3" />
                              </button>
                            </div>

                            <div className="p-3">
                              <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                                {rec.image_name}
                              </h4>
                              {/* Where this image originally came from: parent folder / subfolder */}
                              {folderPathOf(rec) && (
                                <div
                                  className="mt-1 inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] font-semibold text-indigo-700"
                                  title={folderPathOf(rec)}
                                >
                                  <Folder className="w-2.5 h-2.5 shrink-0" />
                                  <span className="truncate">{folderPathOf(rec)}</span>
                                </div>
                              )}
                              <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">
                                {rec.notes || 'No quality notes added.'}
                              </p>
                            </div>
                          </div>

                          <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                            <span>{new Date(rec.assessed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <button
                              onClick={() => onDeleteAssessment(rec.id)}
                              className="text-slate-400 hover:text-rose-600 p-1 rounded"
                              title="Delete this classification"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-xs text-slate-500">
                      Evaluator {currentSummary.evaluatorNumber} has not classified any items as "{evaluatorCategoryFilter}".
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* RAW AUDIT LOG TABLE (WHEN SWITCHED TO TABLE MODE) */}
            {evaluatorViewMode === 'raw_table' && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                <h4 className="text-sm font-bold text-slate-900 mb-4">
                  Full Assessment Audit Trail ({allAssessments.length} total entries)
                </h4>
                {allAssessments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                          <th className="py-2.5 px-3 w-8">
                            <input
                              type="checkbox"
                              checked={allAssessments.length > 0 && selectedAssessmentIds.size === allAssessments.length}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedAssessmentIds(new Set(allAssessments.map(a => a.id)));
                                } else {
                                  setSelectedAssessmentIds(new Set());
                                }
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </th>
                          <th className="py-2.5 px-3 font-bold">Image</th>
                          <th className="py-2.5 px-3 font-bold">Item Name</th>
                          <th className="py-2.5 px-3 font-bold">Source Folder</th>
                          <th className="py-2.5 px-3 font-bold">Evaluator</th>
                          <th className="py-2.5 px-3 font-bold">Classification</th>
                          <th className="py-2.5 px-3 font-bold">Date & Time</th>
                          <th className="py-2.5 px-3 font-bold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allAssessments.map((a) => {
                          const userMatch = userSummaries.find((u) => u.userId === a.user_id);
                          const userLabel = userMatch ? `Evaluator ${userMatch.evaluatorNumber}` : a.user_id;

                          return (
                            <tr key={a.id} className={`hover:bg-slate-50 transition-colors ${selectedAssessmentIds.has(a.id) ? 'bg-indigo-50/30' : ''}`}>
                              <td className="py-2 px-3">
                                <input
                                  type="checkbox"
                                  checked={selectedAssessmentIds.has(a.id)}
                                  onChange={(e) => {
                                    const next = new Set(selectedAssessmentIds);
                                    if (e.target.checked) {
                                      next.add(a.id);
                                    } else {
                                      next.delete(a.id);
                                    }
                                    setSelectedAssessmentIds(next);
                                  }}
                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <img
                                  src={a.image_url}
                                  alt={a.image_name}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-100"
                                />
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-800">
                                {a.image_name}
                              </td>
                              <td className="py-2 px-3">
                                {folderPathOf(a) ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-100 text-[10px] font-semibold text-indigo-700 max-w-[220px]">
                                    <Folder className="w-2.5 h-2.5 shrink-0" />
                                    <span className="truncate" title={folderPathOf(a)}>
                                      {folderPathOf(a)}
                                    </span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                              <td className="py-2 px-3 font-semibold text-indigo-700">
                                {userLabel}
                              </td>
                              <td className="py-2 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                                    a.classification === 'fresh'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : a.classification === 'semi-fresh'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {a.classification}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-400 text-[11px]">
                                {new Date(a.assessed_at).toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  onClick={() => onDeleteAssessment(a.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                                  title="Delete assessment"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 py-6 text-center">No assessments logged yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* TAB 3: ANALYTICS DASHBOARD */}
      {adminTab === 'analytics' && (
        <AdminAnalytics allAssessments={allAssessments} items={items} />
      )}

      {/* TAB 4: SUPABASE SINGLE-TABLE DATABASE */}
      {adminTab === 'supabase' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Supabase Connection Setup */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Supabase Single-Table Connection
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Connect your Supabase project to persist and sync all freshness labels into one table.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 mt-5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={dbUrl}
                    onChange={(e) => setDbUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Supabase Anon Public Key
                  </label>
                  <input
                    type="password"
                    value={dbKey}
                    onChange={(e) => setDbKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Table Name (Single Table)
                  </label>
                  <input
                    type="text"
                    value={dbTable}
                    onChange={(e) => setDbTable(e.target.value)}
                    placeholder="freshness_assessments"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="autoSync"
                    checked={dbAutoSync}
                    onChange={(e) => setDbAutoSync(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="autoSync" className="text-xs text-slate-700 font-semibold cursor-pointer">
                    Automatically sync every user swipe directly to Supabase table
                  </label>
                </div>

                {connectionMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs font-semibold ${
                      connectionSuccess
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {connectionMessage}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center gap-3 mt-6">
              <button
                type="button"
                onClick={handleSaveAndTestSupabase}
                disabled={testingConnection}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {testingConnection ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>Test & Save Connection</span>
              </button>

              <button
                type="button"
                onClick={handleSyncNow}
                disabled={testingConnection || !dbUrl}
                title="Reload all evaluator assessments from Supabase"
                className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Assessments</span>
              </button>

              <button
                type="button"
                onClick={handlePushDatasetImages}
                disabled={testingConnection || !dbUrl || items.length === 0}
                title="Upload all dataset images to the Supabase dataset_items table"
                className="py-2.5 px-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Push Images</span>
              </button>
            </div>
          </div>

          {/* SQL Generator */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Complete Supabase SQL Schema
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Includes admin_users, folders, dataset items, evaluators &amp; assessments.
                  </p>
                </div>

                <button
                  onClick={handleCopySQL}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {copiedSql ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL</span>
                    </>
                  )}
                </button>
              </div>

              <div className="relative mt-4">
                <pre className="p-3.5 rounded-2xl bg-slate-950 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-80 leading-relaxed border border-slate-800">
                  {generateSupabaseSQLTable(dbTable.trim() || 'freshness_assessments')}
                </pre>
              </div>
            </div>

            <div className="pt-4 text-xs text-slate-500">
              💡 <strong>Ready to Run:</strong> Run this script in your Supabase SQL Editor. It creates all tables, seeds the default admin user, creates dataset folders, inserts sample food images, and configures public access policies.
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD FOLDER / SUBFOLDER */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-slate-900">
                {isParentFolderCreation ? 'Create Parent Folder' : 'Create Subfolder'}
              </h4>
              <button
                onClick={() => setIsFolderModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder={isParentFolderCreation ? 'e.g. PRODUCE BATCH 2026' : 'e.g. premium-fresh'}
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {!isParentFolderCreation && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Parent Folder
                  </label>
                  <select
                    value={newFolderParentId || ''}
                    onChange={(e) => setNewFolderParentId(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Top Level (Root)</option>
                    {folders.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DATASET IMAGE FILE */}
      {isItemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-slate-900">
                {editingItem ? 'Edit Dataset Item' : 'Add New Image to Dataset'}
              </h4>
              <button
                onClick={() => setIsItemModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitItem} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item / Food Title
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g. Fresh Red Apple, Honeycrisp"
                  required
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Image Source (Upload or URL)
                </label>
                <div className="space-y-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    disabled={itemUploading}
                    className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer disabled:opacity-60"
                  />
                  {itemUploading && (
                    <div className="text-[11px] font-semibold text-indigo-600">
                      Uploading image to Supabase Storage...
                    </div>
                  )}
                  {itemUploadError && (
                    <div className="text-[11px] font-semibold text-rose-600">{itemUploadError}</div>
                  )}
                  <div className="text-[11px] text-slate-400 text-center font-medium">or paste image URL directly:</div>
                  <input
                    type="url"
                    value={itemUrl}
                    onChange={(e) => setItemUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/photo-..."
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                </div>
              </div>

              {itemUrl && (
                <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                  <img
                    src={itemUrl}
                    alt="Preview"
                    className="w-14 h-14 object-cover rounded-lg bg-white"
                  />
                  <span className="text-xs text-slate-600 font-semibold truncate">
                    Preview Ready
                  </span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dataset Folder
                  </label>
                  <select
                    value={itemSubFolder}
                    onChange={(e) => {
                      const selected = folders.find(f => f.name === e.target.value);
                      setItemSubFolder(e.target.value);
                      if (selected && selected.parentId) {
                        const parent = folders.find(f => f.id === selected.parentId);
                        if (parent) setItemParentFolder(parent.name);
                      }
                    }}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {folders.map((f) => {
                      const getDepth = (id: string | null): number => {
                        if (!id) return 0;
                        const parent = folders.find(p => p.id === id);
                        return 1 + getDepth(parent?.parentId || null);
                      };
                      const depth = getDepth(f.parentId);
                      return (
                        <option key={f.id} value={f.name}>
                          {'\u00A0'.repeat(depth * 2)}{f.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description / Quality Notes
                </label>
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  placeholder="Peel condition, firmness, surface spots, mold presence..."
                  rows={2}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tags (Comma separated)
                </label>
                <input
                  type="text"
                  value={itemTags}
                  onChange={(e) => setItemTags(e.target.value)}
                  placeholder="fruit, apple, crisp, organic"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsItemModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingItem ? 'Save Changes' : 'Add to Dataset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BULK UPLOAD (MULTIPLE IMAGES OR WHOLE FOLDER) */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-base font-bold text-slate-900">Bulk Upload Images</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Add many images at once, or upload an entire folder with its subfolders.
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl mb-4">
              <button
                type="button"
                onClick={() => setBulkMode('files')}
                className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  bulkMode === 'files' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Multiple Images</span>
              </button>
              <button
                type="button"
                onClick={() => setBulkMode('folder')}
                className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                  bulkMode === 'folder' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5" />
                <span>Whole Folder</span>
              </button>
            </div>

            {bulkMode === 'folder' && (
              <p className="mb-3 text-[11px] text-slate-500 bg-indigo-50/70 border border-indigo-100 rounded-xl px-3 py-2 leading-relaxed">
                Pick a folder (or drag it in). Each immediate subfolder becomes a subfolder in the
                dataset, and every image inside is uploaded into it.
              </p>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setBulkIsDragOver(true);
              }}
              onDragLeave={() => setBulkIsDragOver(false)}
              onDrop={handleBulkDrop}
              className={`rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${
                bulkIsDragOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50'
              }`}
            >
              <Upload className="w-7 h-7 text-indigo-500 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">
                Drag & drop {bulkMode === 'folder' ? 'a folder or images' : 'images'} here
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 mb-3">PNG, JPG, WEBP and more</p>
              <div className="flex items-center justify-center gap-2">
                {bulkMode === 'files' ? (
                  <button
                    type="button"
                    onClick={() => bulkFilesInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Choose Images
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => bulkFolderInputRef.current?.click()}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Choose Folder
                  </button>
                )}
                {bulkFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setBulkFiles([])}
                    className="px-3.5 py-2 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-bold"
                  >
                    Clear
                  </button>
                )}
              </div>
              <input
                ref={bulkFilesInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkFilesPicked}
                className="hidden"
              />
              <input
                ref={bulkFolderInputRef}
                type="file"
                multiple
                {...({ webkitdirectory: '', directory: '' } as any)}
                onChange={handleBulkFolderPicked}
                className="hidden"
              />
            </div>

            {/* Selection summary */}
            {bulkFiles.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">
                    {bulkImageCount} image{bulkImageCount === 1 ? '' : 's'} selected ·{' '}
                    {formatFileSize(bulkTotalBytes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkFiles([])}
                    className="text-[11px] font-bold text-rose-500 hover:text-rose-700"
                  >
                    Remove all
                  </button>
                </div>

                {bulkMode === 'folder' && folderPlan ? (
                  <div className="space-y-1.5">
                    {bulkRootFolderName.trim() && (
                      <div className="text-[11px] text-slate-500">
                        Parent folder:{' '}
                        <span className="font-mono font-bold text-indigo-600">
                          {bulkRootFolderName.trim()}
                        </span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {folderPlan.subfolderNames.map((name) => (
                        <span
                          key={name}
                          className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100"
                        >
                          {name} ({folderPlan.assignments.filter((a) => a.subFolder === name).length})
                        </span>
                      ))}
                      {folderPlan.directCount > 0 && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          root files ({folderPlan.directCount}) → {bulkSubFolder}
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {bulkFiles.slice(0, 40).map((file, idx) => (
                      <span
                        key={`${file.name}-${idx}`}
                        className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 truncate max-w-[180px]"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                    ))}
                    {bulkFiles.length > 40 && (
                      <span className="text-[10px] text-slate-400 px-1 py-0.5">
                        +{bulkFiles.length - 40} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Folder name (folder mode only) */}
            {bulkMode === 'folder' && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Parent Folder Name
                  </label>
                  <input
                    type="text"
                    value={bulkRootFolderName}
                    onChange={(e) => setBulkRootFolderName(e.target.value)}
                    placeholder="e.g. PRODUCE BATCH 2026"
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Subfolder for root-level images
                  </label>
                  <select
                    value={bulkSubFolder}
                    onChange={(e) => setBulkSubFolder(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800"
                  >
                    {folders.map((f) => {
                      const getDepth = (id: string | null): number => {
                        if (!id) return 0;
                        const parent = folders.find(p => p.id === id);
                        return 1 + getDepth(parent?.parentId || null);
                      };
                      const depth = getDepth(f.parentId);
                      return (
                        <option key={f.id} value={f.name}>
                          {'\u00A0'.repeat(depth * 2)}{f.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
            )}

            {/* Target folder (files mode only) */}
            {bulkMode === 'files' && (
              <div className="mt-4">
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Upload to Folder
                </label>
                <select
                  value={bulkSubFolder}
                  onChange={(e) => {
                    const selected = folders.find(f => f.name === e.target.value);
                    setBulkSubFolder(e.target.value);
                    if (selected && selected.parentId) {
                      const parent = folders.find(f => f.id === selected.parentId);
                      if (parent) setBulkParentFolder(parent.name);
                    }
                  }}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {folders.map((f) => {
                    const getDepth = (id: string | null): number => {
                      if (!id) return 0;
                      const parent = folders.find(p => p.id === id);
                      return 1 + getDepth(parent?.parentId || null);
                    };
                    const depth = getDepth(f.parentId);
                    return (
                      <option key={f.id} value={f.name}>
                        {'\u00A0'.repeat(depth * 2)}{f.name}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Shared metadata */}
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Description (applied to all)
                </label>
                <input
                  type="text"
                  value={bulkDescription}
                  onChange={(e) => setBulkDescription(e.target.value)}
                  placeholder="Optional quality notes"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={bulkTags}
                  onChange={(e) => setBulkTags(e.target.value)}
                  placeholder="fruit, apple, organic"
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {bulkImageCount > 0 && (
              <div className="mt-3 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-semibold flex items-start gap-2">
                <Database className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                <span>
                  {bulkImageCount} image{bulkImageCount === 1 ? '' : 's'} ({formatFileSize(bulkTotalBytes)}) will be
                  uploaded to Supabase Storage — batch size is not limited by browser storage.
                </span>
              </div>
            )}

            {bulkError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{bulkError}</span>
              </div>
            )}

            {bulkNotice && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{bulkNotice}</span>
              </div>
            )}

            {bulkProgress && (
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1">
                  <span>Uploading images to Supabase...</span>
                  <span>
                    {bulkProgress.done} / {bulkProgress.total}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 transition-all"
                    style={{
                      width: `${
                        bulkProgress.total > 0
                          ? Math.round((bulkProgress.done / bulkProgress.total) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-bold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRunBulkImport}
                disabled={bulkIsImporting || bulkImageCount === 0}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                {bulkIsImporting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                <span>
                  {bulkIsImporting
                    ? 'Importing...'
                    : `Upload ${bulkImageCount > 0 ? bulkImageCount : ''} Image${
                        bulkImageCount === 1 ? '' : 's'
                      }`.replace('  ', ' ')}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PREVIEW IMAGE MODAL */}
      {previewModalImage && (
        <div
          onClick={() => setPreviewModalImage(null)}
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-xs cursor-pointer"
        >
          <div className="relative max-w-3xl w-full flex items-center justify-center">
            <img
              src={previewModalImage}
              alt="Preview"
              className="max-h-[85vh] w-auto rounded-2xl shadow-2xl object-contain"
            />
            <button
              onClick={() => setPreviewModalImage(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 text-white hover:bg-black"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
