import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  AssessmentRecord, 
  DatasetItem, 
  FolderNode, 
  FreshnessClass, 
  SupabaseConfig, 
  UserSession 
} from '../types/freshness';

const STORAGE_KEYS = {
  USER_SESSION: 'freshness_user_session',
  FOLDERS: 'freshness_folders_v1',
  DATASET_ITEMS: 'freshness_dataset_items_v1',
  ASSESSMENTS: 'freshness_assessments_records_v1',
  SUPABASE_CONFIG: 'freshness_supabase_config_v1',
};

export const DEFAULT_PARENT_FOLDER_NAME = 'FRESHNESS ASSESSMENT';

// Pre-seeded folders
export const DEFAULT_FOLDERS: FolderNode[] = [
  {
    id: 'parent_freshness_assessment',
    name: DEFAULT_PARENT_FOLDER_NAME,
    parentId: null,
    isParent: true,
    createdAt: new Date().toISOString(),
    description: 'Master classification repository for food freshness models',
  },
  {
    id: 'sub_fresh',
    name: 'fresh',
    parentId: 'parent_freshness_assessment',
    isParent: false,
    createdAt: new Date().toISOString(),
    description: 'High quality, firm texture, vibrant color',
  },
  {
    id: 'sub_semi_fresh',
    name: 'semi-fresh',
    parentId: 'parent_freshness_assessment',
    isParent: false,
    createdAt: new Date().toISOString(),
    description: 'Beginning to soften, minor blemishes, slightly aged',
  },
  {
    id: 'sub_spoiled',
    name: 'spoiled',
    parentId: 'parent_freshness_assessment',
    isParent: false,
    createdAt: new Date().toISOString(),
    description: 'Decomposed, moldy, discolored, unsafe for consumption',
  },
];

// Pre-seeded high quality sample images
export const DEFAULT_DATASET_ITEMS: DatasetItem[] = [
  // Fresh items
  {
    id: 'img_fresh_01',
    name: 'Crisp Royal Gala Apple',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'fresh',
    imageUrl: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80',
    description: 'Bright red peel, firm stem, glossy skin with zero bruises.',
    fileSize: '412 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    tags: ['fruit', 'apple', 'fresh'],
  },
  {
    id: 'img_fresh_02',
    name: 'Wild Atlantic Salmon Fillet',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'fresh',
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=800&q=80',
    description: 'Firm flesh, translucent coral-orange color, clean ocean aroma.',
    fileSize: '530 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
    tags: ['seafood', 'salmon', 'fresh'],
  },
  {
    id: 'img_fresh_03',
    name: 'Sweet Garden Strawberries',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'fresh',
    imageUrl: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=800&q=80',
    description: 'Plump scarlet berries, green leafy calyx, firm surface.',
    fileSize: '495 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
    tags: ['berry', 'strawberry', 'fresh'],
  },
  {
    id: 'img_fresh_04',
    name: 'Crisp Green Bell Pepper',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'fresh',
    imageUrl: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?auto=format&fit=crop&w=800&q=80',
    description: 'Tight smooth skin, thick walls, crisp snapping texture.',
    fileSize: '380 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
    tags: ['vegetable', 'pepper', 'fresh'],
  },

  // Semi-fresh items
  {
    id: 'img_semi_01',
    name: 'Spotted Ripened Banana',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'semi-fresh',
    imageUrl: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=800&q=80',
    description: 'Yellow peel with brown sugar spots, softening texture.',
    fileSize: '390 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
    tags: ['fruit', 'banana', 'semi-fresh'],
  },
  {
    id: 'img_semi_02',
    name: 'Slightly Wrinkled Orange',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'semi-fresh',
    imageUrl: 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=800&q=80',
    description: 'Citrus peel showing minor moisture loss and loss of sheen.',
    fileSize: '425 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 10).toISOString(),
    tags: ['citrus', 'orange', 'semi-fresh'],
  },
  {
    id: 'img_semi_03',
    name: 'Mellowing Vine Tomato',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'semi-fresh',
    imageUrl: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=800&q=80',
    description: 'Skin beginning to crinkle near stem, soft to gentle touch.',
    fileSize: '360 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    tags: ['vegetable', 'tomato', 'semi-fresh'],
  },

  // Spoiled items
  {
    id: 'img_spoil_01',
    name: 'Decayed Blackened Banana',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'spoiled',
    imageUrl: 'https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=800&q=80',
    description: 'Severe skin blackening, liquefied flesh, sour fermentation.',
    fileSize: '405 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 6).toISOString(),
    tags: ['fruit', 'banana', 'spoiled'],
  },
  {
    id: 'img_spoil_02',
    name: 'Moldy Stored Bread',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'spoiled',
    imageUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80',
    description: 'Visible white and blue-green fungal colonies across surface.',
    fileSize: '460 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    tags: ['bakery', 'bread', 'spoiled'],
  },
  {
    id: 'img_spoil_03',
    name: 'Wilting Withered Lettuce',
    parentFolder: DEFAULT_PARENT_FOLDER_NAME,
    subFolder: 'spoiled',
    imageUrl: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=800&q=80',
    description: 'Brown slimy edges, limp watery breakdown, strong off-odor.',
    fileSize: '430 KB',
    uploadedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    tags: ['vegetable', 'lettuce', 'spoiled'],
  },
];

export function generateUserId(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let result = 'usr_';
  for (let i = 0; i < 7; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getUserSession(): UserSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.USER_SESSION);
    if (!raw) return null;
    return JSON.parse(raw) as UserSession;
  } catch {
    return null;
  }
}

export function saveUserSession(session: UserSession): void {
  try {
    localStorage.setItem(STORAGE_KEYS.USER_SESSION, JSON.stringify(session));
  } catch (e) {
    console.error('Failed to save user session', e);
  }
}

export function clearUserSession(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.USER_SESSION);
  } catch (e) {
    console.error('Failed to clear user session', e);
  }
}

export function getFolders(): FolderNode[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.FOLDERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(DEFAULT_FOLDERS));
      return DEFAULT_FOLDERS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_FOLDERS;
  }
}

export function saveFolders(folders: FolderNode[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(folders));
  } catch (e) {
    console.error('Failed to save folders', e);
  }
}

export function getDatasetItems(): DatasetItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DATASET_ITEMS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.DATASET_ITEMS, JSON.stringify(DEFAULT_DATASET_ITEMS));
      return DEFAULT_DATASET_ITEMS;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DATASET_ITEMS;
  }
}

export function saveDatasetItems(items: DatasetItem[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEYS.DATASET_ITEMS, JSON.stringify(items));
    return true;
  } catch (e) {
    console.error('Failed to save dataset items', e);
    return false;
  }
}

export function getAllAssessments(): AssessmentRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ASSESSMENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getUserAssessments(userId: string): AssessmentRecord[] {
  const all = getAllAssessments();
  return all.filter((item) => item.user_id === userId);
}

export const ADMIN_CREDENTIALS = {
  username: 'leirad',
  password: 'Ganzon2003',
};

export function verifyAdminCredentials(user: string, pass: string): boolean {
  return user.trim() === ADMIN_CREDENTIALS.username && pass === ADMIN_CREDENTIALS.password;
}

export async function registerUserToSupabase(userId: string, config: SupabaseConfig): Promise<boolean> {
  const client = getSupabaseClient(config);
  if (!client) return false;
  try {
    const tableName = config.tableName || 'freshness_assessments';
    const payload = {
      id: `user_init_${userId}`,
      user_id: userId,
      image_id: 'user_onboarding',
      image_name: 'User Registered / Started',
      image_url: '',
      parent_folder: DEFAULT_PARENT_FOLDER_NAME,
      sub_folder: 'registration',
      classification: 'user_registered',
      assessed_at: new Date().toISOString(),
      notes: 'Initial user session activated',
    };
    const { error } = await client.from(tableName).upsert(payload);
    if (error) {
      console.warn('Supabase user registration error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Failed to register user to Supabase:', err);
    return false;
  }
}

export function saveAssessmentRecord(record: AssessmentRecord): void {
  try {
    const all = getAllAssessments();
    // Replace if user previously assessed this image, or append
    const existingIndex = all.findIndex(
      (a) => a.user_id === record.user_id && a.image_id === record.image_id
    );
    if (existingIndex >= 0) {
      all[existingIndex] = record;
    } else {
      all.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(all));

    // Auto sync to Supabase if configured
    const config = getSupabaseConfig();
    if (config.autoSync && config.url && config.anonKey) {
      syncRecordToSupabase(record, config).catch((err) => {
        console.warn('Background Supabase sync failed:', err);
      });
    }
  } catch (e) {
    console.error('Failed to save assessment', e);
  }
}

export function deleteAssessmentRecord(id: string): void {
  try {
    const all = getAllAssessments();
    const filtered = all.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEYS.ASSESSMENTS, JSON.stringify(filtered));
  } catch (e) {
    console.error('Failed to delete assessment', e);
  }
}

const FALLBACK_SUPABASE_URL = 'https://kejoyjmselrzkrbgisvu.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtlam95am1zZWxyemtyYmdpc3Z1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwOTY1NjIsImV4cCI6MjEwODY3MjU2Mn0.kvX2wd9P5P-xCsKNyC0cyGY_yOd10rdOf_UF0ax3g2c';

function readVercelSupabaseEnv(): { url?: string; anonKey?: string } {
  return {
    url: import.meta.env.VITE_SUPABASE_URL?.trim() || undefined,
    anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || undefined,
  };
}

/** Default config: Vercel `VITE_*` vars at build time, then project fallbacks. */
export function createDefaultSupabaseConfig(): SupabaseConfig {
  const env = readVercelSupabaseEnv();
  const url = env.url || FALLBACK_SUPABASE_URL;
  const anonKey = env.anonKey || FALLBACK_SUPABASE_ANON_KEY;
  return {
    url,
    anonKey,
    tableName: 'freshness_assessments',
    autoSync: true,
    isConnected: Boolean(url && anonKey),
  };
}

export function getSupabaseConfig(): SupabaseConfig {
  const env = readVercelSupabaseEnv();
  const defaults = createDefaultSupabaseConfig();
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SUPABASE_CONFIG);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    return {
      ...defaults,
      ...parsed,
      // Production credentials from Vercel always win when set at build time.
      url: env.url || parsed.url || defaults.url,
      anonKey: env.anonKey || parsed.anonKey || defaults.anonKey,
      tableName: parsed.tableName?.trim() || defaults.tableName,
      autoSync: parsed.autoSync ?? defaults.autoSync,
    };
  } catch {
    return defaults;
  }
}

export function saveSupabaseConfig(config: SupabaseConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SUPABASE_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save Supabase config', e);
  }
}

let cachedSupabaseKey: string | null = null;
let cachedSupabaseClient: SupabaseClient | null = null;

const SUPABASE_CLIENT_OPTIONS = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
};

export function getSupabaseClient(config: SupabaseConfig): SupabaseClient | null {
  if (!config.url || !config.anonKey) return null;

  const url = config.url.trim();
  const anonKey = config.anonKey.trim();
  const cacheKey = `${url}::${anonKey}`;

  if (cachedSupabaseClient && cachedSupabaseKey === cacheKey) {
    return cachedSupabaseClient;
  }

  try {
    cachedSupabaseKey = cacheKey;
    cachedSupabaseClient = createClient(url, anonKey, SUPABASE_CLIENT_OPTIONS);
    return cachedSupabaseClient;
  } catch (err) {
    cachedSupabaseKey = null;
    cachedSupabaseClient = null;
    console.error('Invalid Supabase parameters', err);
    return null;
  }
}

export async function testSupabaseConnection(config: SupabaseConfig): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient(config);
  if (!client) {
    return { success: false, message: 'Supabase URL or Anon Key is missing or invalid format.' };
  }
  try {
    const tableName = config.tableName || 'freshness_assessments';
    const { data, error } = await client.from(tableName).select('id').limit(1);
    if (error) {
      return { 
        success: false, 
        message: `Database connected, but table "${tableName}" returned: ${error.message}. Make sure the table exists!` 
      };
    }
    return { 
      success: true, 
      message: `Successfully connected to Supabase table "${tableName}"! Total queried records: ${data ? data.length : 0}.` 
    };
  } catch (err: any) {
    return { success: false, message: `Connection error: ${err.message || 'Unknown network error'}` };
  }
}

export async function syncRecordToSupabase(record: AssessmentRecord, config: SupabaseConfig): Promise<boolean> {
  const client = getSupabaseClient(config);
  if (!client) return false;
  try {
    const tableName = config.tableName || 'freshness_assessments';
    const payload = {
      id: record.id,
      user_id: record.user_id,
      image_id: record.image_id,
      image_name: record.image_name,
      image_url: record.image_url,
      parent_folder: record.parent_folder,
      sub_folder: record.sub_folder,
      classification: record.classification,
      assessed_at: record.assessed_at,
      notes: record.notes || null,
    };
    const { error } = await client.from(tableName).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.error('Supabase upsert error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to sync to Supabase:', err);
    return false;
  }
}

export async function syncAllToSupabase(config: SupabaseConfig): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { count: 0, error: 'Supabase client not initialized' };
  const all = getAllAssessments();
  if (all.length === 0) return { count: 0 };

  const tableName = config.tableName || 'freshness_assessments';
  const rows = all.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    image_id: r.image_id,
    image_name: r.image_name,
    image_url: r.image_url,
    parent_folder: r.parent_folder,
    sub_folder: r.sub_folder,
    classification: r.classification,
    assessed_at: r.assessed_at,
    notes: r.notes || null,
  }));

  try {
    const { error } = await client.from(tableName).upsert(rows);
    if (error) return { count: 0, error: error.message };
    return { count: rows.length };
  } catch (err: any) {
    return { count: 0, error: err.message };
  }
}

// ============================================================
// DATASET IMAGES (dataset_items) <-> SUPABASE
// ============================================================
export const DATASET_ITEMS_TABLE = 'dataset_items';

const ASSESSMENT_CLASSES: FreshnessClass[] = ['fresh', 'semi-fresh', 'spoiled'];

// PostgREST caps a single response at ~1000 rows. Large admin uploads (many folder
// trees) would silently lose everything past the first page, so we page through
// every row until the table is exhausted.
const SUPABASE_PAGE_SIZE = 1000;

type SupabasePageQuery = (
  from: number,
  to: number
) => PromiseLike<{ data: any[] | null; error: { message: string } | null }>;

async function fetchAllPages(build: SupabasePageQuery): Promise<{ rows: any[]; error?: string }> {
  const rows: any[] = [];
  for (let from = 0; ; from += SUPABASE_PAGE_SIZE) {
    const { data, error } = await build(from, from + SUPABASE_PAGE_SIZE - 1);
    if (error) return { rows: [], error: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < SUPABASE_PAGE_SIZE) break;
  }
  return { rows };
}

export function mapDatasetRowToItem(row: any): DatasetItem {
  return {
    id: String(row.id),
    name: row.name || 'Untitled',
    parentFolder: row.parent_folder || DEFAULT_PARENT_FOLDER_NAME,
    subFolder: row.sub_folder || 'fresh',
    imageUrl: row.image_url || '',
    description: row.description || '',
    fileSize: row.file_size || '',
    uploadedAt: row.created_at || new Date().toISOString(),
    tags: [],
  };
}

function mapAssessmentRowToRecord(row: any): AssessmentRecord {
  return {
    id: String(row.id),
    user_id: String(row.user_id || ''),
    image_id: String(row.image_id || ''),
    image_name: row.image_name || 'Untitled',
    image_url: row.image_url || '',
    parent_folder: row.parent_folder || DEFAULT_PARENT_FOLDER_NAME,
    sub_folder: row.sub_folder || '',
    classification: row.classification as FreshnessClass,
    assessed_at: row.assessed_at || new Date().toISOString(),
    notes: row.notes || '',
  };
}

// Reads every dataset image stored in Supabase (used by the evaluator dashboard)
export async function fetchDatasetItemsFromSupabase(
  config: SupabaseConfig
): Promise<{ items: DatasetItem[]; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { items: [], error: 'Supabase is not configured.' };
  try {
    const { rows, error } = await fetchAllPages((from, to) =>
      client
        .from(DATASET_ITEMS_TABLE)
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );
    if (error) return { items: [], error };
    return {
      items: rows.filter((row) => row.image_url).map(mapDatasetRowToItem),
    };
  } catch (err: any) {
    return { items: [], error: err?.message || 'Failed to load dataset images.' };
  }
}

function toDatasetRow(item: DatasetItem) {
  return {
    id: item.id,
    name: item.name,
    folder_id: null,
    parent_folder: item.parentFolder,
    sub_folder: item.subFolder,
    ground_truth: item.subFolder,
    image_url: item.imageUrl,
    description: item.description || null,
    file_size: item.fileSize || null,
  };
}

// Pushes one or many dataset images up to Supabase (admin create / edit / bulk upload)
export async function upsertDatasetItemsToSupabase(
  items: DatasetItem[],
  config: SupabaseConfig
): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { count: 0, error: 'Supabase is not configured.' };
  if (items.length === 0) return { count: 0 };
  try {
    const { error } = await client.from(DATASET_ITEMS_TABLE).upsert(items.map(toDatasetRow));
    if (error) return { count: 0, error: error.message };
    return { count: items.length };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Upload to Supabase failed.' };
  }
}

export async function deleteDatasetItemsFromSupabase(
  ids: string[],
  config: SupabaseConfig
): Promise<{ error?: string }> {
  const client = getSupabaseClient(config);
  if (!client || ids.length === 0) return {};
  try {
    const { error } = await client.from(DATASET_ITEMS_TABLE).delete().in('id', ids);
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err?.message || 'Delete from Supabase failed.' };
  }
}

// ============================================================
// FOLDERS <-> SUPABASE
// ============================================================
export const FOLDERS_TABLE = 'folders';

export function mapFolderRowToNode(row: any): FolderNode {
  return {
    id: String(row.id),
    name: row.name || 'Untitled Folder',
    parentId: row.parent_id ?? null,
    isParent: Boolean(row.is_parent),
    createdAt: row.created_at || new Date().toISOString(),
  };
}

const toFolderRow = (folder: FolderNode) => ({
  id: folder.id,
  name: folder.name,
  parent_id: folder.parentId,
  is_parent: folder.isParent,
});

// folders.parent_id is a foreign key, so every ancestor must be written before
// its descendants. Emit folders in dependency order.
function sortFoldersByHierarchy(folders: FolderNode[]): FolderNode[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const emitted = new Set<string>();
  const ordered: FolderNode[] = [];
  const visit = (folder: FolderNode, guard: Set<string>) => {
    if (emitted.has(folder.id) || guard.has(folder.id)) return;
    guard.add(folder.id);
    const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
    if (parent) visit(parent, guard);
    if (!emitted.has(folder.id)) {
      emitted.add(folder.id);
      ordered.push(folder);
    }
  };
  folders.forEach((f) => visit(f, new Set()));
  return ordered;
}

// Reads every folder row from Supabase so the admin folder tree reflects the cloud state.
export async function fetchFoldersFromSupabase(
  config: SupabaseConfig
): Promise<{ folders: FolderNode[]; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { folders: [], error: 'Supabase is not configured.' };
  try {
    const { rows, error } = await fetchAllPages((from, to) =>
      client
        .from(FOLDERS_TABLE)
        .select('*')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );
    if (error) return { folders: [], error };
    return { folders: rows.map(mapFolderRowToNode) };
  } catch (err: any) {
    return { folders: [], error: err?.message || 'Failed to load folders from Supabase.' };
  }
}

export async function upsertFoldersToSupabase(
  folders: FolderNode[],
  config: SupabaseConfig
): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { count: 0, error: 'Supabase is not configured.' };
  if (folders.length === 0) return { count: 0 };
  try {
    const { error } = await client
      .from(FOLDERS_TABLE)
      .upsert(sortFoldersByHierarchy(folders).map(toFolderRow));
    if (error) return { count: 0, error: error.message };
    return { count: folders.length };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Folder upload to Supabase failed.' };
  }
}

export async function deleteFoldersFromSupabase(
  ids: string[],
  config: SupabaseConfig
): Promise<{ error?: string }> {
  const client = getSupabaseClient(config);
  if (!client || ids.length === 0) return {};
  try {
    const { error } = await client.from(FOLDERS_TABLE).delete().in('id', ids);
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err?.message || 'Folder delete on Supabase failed.' };
  }
}

// ============================================================
// DATASET IMAGE FILES <-> SUPABASE STORAGE
// ============================================================
export const DATASET_IMAGES_BUCKET = 'dataset-images';

const sanitizePathSegment = (value: string): string =>
  value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'image';

// Uploads a single image file to Supabase Storage and returns its public URL.
// Keeps image bytes out of localStorage so large batches no longer hit the ~5 MB quota.
export async function uploadDatasetImageToSupabase(
  file: File,
  config: SupabaseConfig,
  folderPath = ''
): Promise<{ publicUrl?: string; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase is not configured — connect it before uploading images.' };

  const folder = folderPath
    .split('/')
    .map(sanitizePathSegment)
    .filter(Boolean)
    .join('/');
  const objectPath = `${folder ? `${folder}/` : ''}${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}_${sanitizePathSegment(file.name)}`;

  try {
    const { error } = await client.storage.from(DATASET_IMAGES_BUCKET).upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });
    if (error) return { error: error.message };
    const { data } = client.storage.from(DATASET_IMAGES_BUCKET).getPublicUrl(objectPath);
    return { publicUrl: data.publicUrl };
  } catch (err: any) {
    return { error: err?.message || 'Image upload to Supabase Storage failed.' };
  }
}

// ============================================================
// EVALUATOR HISTORY (assessments) <-> SUPABASE
// ============================================================
export async function fetchUserAssessmentsFromSupabase(
  userId: string,
  config: SupabaseConfig
): Promise<{ records: AssessmentRecord[]; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { records: [], error: 'Supabase is not configured.' };
  const tableName = config.tableName || 'freshness_assessments';
  try {
    const { rows, error } = await fetchAllPages((from, to) =>
      client
        .from(tableName)
        .select('*')
        .eq('user_id', userId)
        .order('assessed_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );
    if (error) return { records: [], error };
    return {
      records: rows
        .filter(
          (row) =>
            row.image_id !== 'user_onboarding' && ASSESSMENT_CLASSES.includes(row.classification)
        )
        .map(mapAssessmentRowToRecord),
    };
  } catch (err: any) {
    return { records: [], error: err?.message || 'Failed to load history from Supabase.' };
  }
}

export async function updateAssessmentClassificationInSupabase(
  id: string,
  classification: FreshnessClass,
  config: SupabaseConfig
): Promise<{ error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase is not configured.' };
  const tableName = config.tableName || 'freshness_assessments';
  try {
    const { error } = await client.from(tableName).update({ classification }).eq('id', id);
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err?.message || 'Update on Supabase failed.' };
  }
}

export async function deleteAssessmentFromSupabase(
  id: string,
  config: SupabaseConfig
): Promise<{ error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { error: 'Supabase is not configured.' };
  const tableName = config.tableName || 'freshness_assessments';
  try {
    const { error } = await client.from(tableName).delete().eq('id', id);
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err?.message || 'Delete on Supabase failed.' };
  }
}

export async function deleteAssessmentsBulkFromSupabase(
  ids: string[],
  config: SupabaseConfig
): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client || ids.length === 0) return { count: 0 };
  const tableName = config.tableName || 'freshness_assessments';
  try {
    const { error } = await client.from(tableName).delete().in('id', ids);
    if (error) return { count: 0, error: error.message };
    return { count: ids.length };
  } catch (err: any) {
    return { count: 0, error: err?.message || 'Bulk delete on Supabase failed.' };
  }
}

// Removes any earlier evaluation a user made for the same image so each evaluator
// keeps exactly one freshness verdict per image (the swipe re-assigns instead of duplicating).
export async function deleteAssessmentByUserAndImageFromSupabase(
  userId: string,
  imageId: string,
  config: SupabaseConfig
): Promise<{ error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return {};
  const tableName = config.tableName || 'freshness_assessments';
  try {
    const { error } = await client
      .from(tableName)
      .delete()
      .eq('user_id', userId)
      .eq('image_id', imageId);
    if (error) return { error: error.message };
    return {};
  } catch (err: any) {
    return { error: err?.message || 'Delete on Supabase failed.' };
  }
}

// Reads every evaluator verdict (fresh / semi-fresh / spoiled) for the admin audit trail.
export async function fetchAllAssessmentsFromSupabase(
  config: SupabaseConfig
): Promise<{ records: AssessmentRecord[]; error?: string }> {
  const client = getSupabaseClient(config);
  if (!client) return { records: [], error: 'Supabase is not configured.' };
  const tableName = config.tableName || 'freshness_assessments';
  try {
    const { rows, error } = await fetchAllPages((from, to) =>
      client
        .from(tableName)
        .select('*')
        .order('assessed_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
    );
    if (error) return { records: [], error };
    return {
      records: rows
        .filter((row) => ASSESSMENT_CLASSES.includes(row.classification))
        .map(mapAssessmentRowToRecord),
    };
  } catch (err: any) {
    return { records: [], error: err?.message || 'Failed to load assessments from Supabase.' };
  }
}

export function generateSupabaseSQLTable(tableName: string = 'freshness_assessments'): string {
  return `-- ============================================================
-- SUPABASE DATABASE SETUP SCRIPT FOR FRESHNESS APP
-- Run this in your Supabase SQL Editor (SQL Editor > New Query)
-- ============================================================

-- 1. ADMIN USERS TABLE & DEFAULT CREDENTIALS
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Admin Credentials (leirad / Ganzon2003)
INSERT INTO public.admin_users (username, password, role)
VALUES ('leirad', 'Ganzon2003', 'superadmin')
ON CONFLICT (username) DO UPDATE 
SET password = EXCLUDED.password, role = EXCLUDED.role;

-- 2. FOLDERS TABLE & HIERARCHY
CREATE TABLE IF NOT EXISTS public.folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id TEXT REFERENCES public.folders(id) ON DELETE CASCADE,
  is_parent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Default Parent and Subfolders
INSERT INTO public.folders (id, name, parent_id, is_parent)
VALUES 
  ('parent-1', 'FRESHNESS ASSESSMENT', NULL, TRUE),
  ('sub-fresh', 'fresh', 'parent-1', FALSE),
  ('sub-semi', 'semi-fresh', 'parent-1', FALSE),
  ('sub-spoiled', 'spoiled', 'parent-1', FALSE)
ON CONFLICT (id) DO NOTHING;

-- 3. DATASET ITEMS / FOOD IMAGES TABLE
CREATE TABLE IF NOT EXISTS public.dataset_items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  folder_id TEXT REFERENCES public.folders(id) ON DELETE CASCADE,
  parent_folder TEXT DEFAULT 'FRESHNESS ASSESSMENT',
  sub_folder TEXT NOT NULL,
  ground_truth TEXT NOT NULL,
  image_url TEXT NOT NULL,
  description TEXT,
  file_size TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Sample Dataset Images
INSERT INTO public.dataset_items (id, name, folder_id, parent_folder, sub_folder, ground_truth, image_url, description, file_size)
VALUES
  ('item-1', 'Crisp Fuji Apple', 'sub-fresh', 'FRESHNESS ASSESSMENT', 'fresh', 'fresh', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80', 'Crisp red skin with no blemishes, firm texture.', '450 KB'),
  ('item-2', 'Ripe Haas Avocado', 'sub-semi', 'FRESHNESS ASSESSMENT', 'semi-fresh', 'semi-fresh', 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?w=800&auto=format&fit=crop&q=80', 'Soft yield under gentle thumb pressure, slight darkening at the stem.', '520 KB'),
  ('item-3', 'Decaying Strawberries', 'sub-spoiled', 'FRESHNESS ASSESSMENT', 'spoiled', 'spoiled', 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?w=800&auto=format&fit=crop&q=80', 'Visible white fungal mycelium spores and soft collapse.', '380 KB'),
  ('item-4', 'Golden Ripe Banana', 'sub-fresh', 'FRESHNESS ASSESSMENT', 'fresh', 'fresh', 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=800&auto=format&fit=crop&q=80', 'Bright yellow peel with minimal sugar spots, firm stem.', '390 KB'),
  ('item-5', 'Browning Banana with Sugar Spots', 'sub-semi', 'FRESHNESS ASSESSMENT', 'semi-fresh', 'semi-fresh', 'https://images.unsplash.com/photo-1543218024-57a70143c369?w=800&auto=format&fit=crop&q=80', 'Heavy sugar speckling and softening flesh.', '410 KB'),
  ('item-6', 'Wilting Romaine Lettuce', 'sub-spoiled', 'FRESHNESS ASSESSMENT', 'spoiled', 'spoiled', 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=800&auto=format&fit=crop&q=80', 'Brown slimy edges and complete structural loss.', '430 KB')
ON CONFLICT (id) DO NOTHING;

-- 4. EVALUATORS TABLE
CREATE TABLE IF NOT EXISTS public.evaluators (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT 'Evaluator',
  gender TEXT,
  age INTEGER,
  user_type TEXT DEFAULT 'evaluator',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert Sample Evaluator
INSERT INTO public.evaluators (id, name, user_type)
VALUES ('usr_demo101', 'Sample Evaluator 1', 'evaluator')
ON CONFLICT (id) DO NOTHING;

-- 5. FRESHNESS ASSESSMENTS TABLE (All User Swipes & Labels)
CREATE TABLE IF NOT EXISTS public.${tableName} (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  image_name TEXT,
  image_url TEXT,
  parent_folder TEXT DEFAULT 'FRESHNESS ASSESSMENT',
  sub_folder TEXT DEFAULT 'fresh',
  classification TEXT NOT NULL,
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Insert Sample Assessment Row
INSERT INTO public.${tableName} (id, user_id, image_id, image_name, image_url, parent_folder, sub_folder, classification, notes)
VALUES 
  ('asmt-sample-1', 'usr_demo101', 'item-1', 'Crisp Fuji Apple', 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?w=800&auto=format&fit=crop&q=80', 'FRESHNESS ASSESSMENT', 'fresh', 'fresh', 'Initial benchmark sample')
ON CONFLICT (id) DO NOTHING;

-- 6. INDEXES FOR HIGH QUERY PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_${tableName}_user_id ON public.${tableName} (user_id);
CREATE INDEX IF NOT EXISTS idx_${tableName}_classification ON public.${tableName} (classification);
CREATE INDEX IF NOT EXISTS idx_${tableName}_sub_folder ON public.${tableName} (sub_folder);
CREATE INDEX IF NOT EXISTS idx_dataset_items_folder ON public.dataset_items (folder_id);

-- 7. ROW LEVEL SECURITY (RLS) POLICIES (Public Anon Read & Write)
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dataset_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;

-- Allow anon public read and write access for all tables
CREATE POLICY "Allow public read admin_users" ON public.admin_users FOR SELECT USING (true);
CREATE POLICY "Allow public read folders" ON public.folders FOR SELECT USING (true);
CREATE POLICY "Allow public write folders" ON public.folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read dataset_items" ON public.dataset_items FOR SELECT USING (true);
CREATE POLICY "Allow public write dataset_items" ON public.dataset_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read evaluators" ON public.evaluators FOR SELECT USING (true);
CREATE POLICY "Allow public write evaluators" ON public.evaluators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read ${tableName}" ON public.${tableName} FOR SELECT USING (true);
CREATE POLICY "Allow public write ${tableName}" ON public.${tableName} FOR ALL USING (true) WITH CHECK (true);

-- 8. STORAGE BUCKET FOR UPLOADED DATASET IMAGES
-- Admin uploads write the raw image files here and only the public URL is stored in dataset_items.
INSERT INTO storage.buckets (id, name, public)
VALUES ('${DATASET_IMAGES_BUCKET}', '${DATASET_IMAGES_BUCKET}', TRUE)
ON CONFLICT (id) DO UPDATE SET public = TRUE;

DROP POLICY IF EXISTS "Public read dataset images" ON storage.objects;
DROP POLICY IF EXISTS "Public upload dataset images" ON storage.objects;
DROP POLICY IF EXISTS "Public update dataset images" ON storage.objects;
DROP POLICY IF EXISTS "Public delete dataset images" ON storage.objects;

CREATE POLICY "Public read dataset images" ON storage.objects
  FOR SELECT USING (bucket_id = '${DATASET_IMAGES_BUCKET}');
CREATE POLICY "Public upload dataset images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = '${DATASET_IMAGES_BUCKET}');
CREATE POLICY "Public update dataset images" ON storage.objects
  FOR UPDATE USING (bucket_id = '${DATASET_IMAGES_BUCKET}') WITH CHECK (bucket_id = '${DATASET_IMAGES_BUCKET}');
CREATE POLICY "Public delete dataset images" ON storage.objects
  FOR DELETE USING (bucket_id = '${DATASET_IMAGES_BUCKET}');
`;
}

export function exportAssessmentsToJSON(assessments: AssessmentRecord[]): string {
  return JSON.stringify(assessments, null, 2);
}

export function exportAssessmentsToCSV(assessments: AssessmentRecord[]): string {
  const headers = [
    'id',
    'user_id',
    'image_id',
    'image_name',
    'image_url',
    'parent_folder',
    'sub_folder',
    'classification',
    'assessed_at',
    'notes'
  ];

  const escapeCSV = (val: string | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = assessments.map((a) => [
    escapeCSV(a.id),
    escapeCSV(a.user_id),
    escapeCSV(a.image_id),
    escapeCSV(a.image_name),
    escapeCSV(a.image_url),
    escapeCSV(a.parent_folder),
    escapeCSV(a.sub_folder),
    escapeCSV(a.classification),
    escapeCSV(a.assessed_at),
    escapeCSV(a.notes || '')
  ].join(','));

  return [headers.join(','), ...rows].join('\n');
}

export function resetDatasetToDefaults(): void {
  localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(DEFAULT_FOLDERS));
  localStorage.setItem(STORAGE_KEYS.DATASET_ITEMS, JSON.stringify(DEFAULT_DATASET_ITEMS));
}

export function getUserDatasetSummaries(
  assessments: AssessmentRecord[],
  totalItemsCount: number
): import('../types/freshness').UserDatasetSummary[] {
  // Filter out system onboarding records
  const validAssessments = assessments.filter(
    (a) => a.image_id !== 'user_onboarding' && (a.classification as string) !== 'user_registered'
  );

  // Group by user_id
  const userMap = new Map<string, AssessmentRecord[]>();
  for (const record of validAssessments) {
    const list = userMap.get(record.user_id) || [];
    list.push(record);
    userMap.set(record.user_id, list);
  }

  // Convert to array and sort by earliest assessment
  const userEntries = Array.from(userMap.entries()).map(([userId, records]) => {
    records.sort((a, b) => new Date(a.assessed_at).getTime() - new Date(b.assessed_at).getTime());
    return { userId, records, firstTime: records[0]?.assessed_at || '' };
  });

  userEntries.sort((a, b) => new Date(a.firstTime).getTime() - new Date(b.firstTime).getTime());

  return userEntries.map((entry, index) => {
    const evaluatorNumber = index + 1;
    const freshRecords = entry.records.filter((r) => r.classification === 'fresh');
    const semiFreshRecords = entry.records.filter((r) => r.classification === 'semi-fresh');
    const spoiledRecords = entry.records.filter((r) => r.classification === 'spoiled');
    const totalAssessed = entry.records.length;
    const completionRate = Math.min(100, Math.round((totalAssessed / Math.max(1, totalItemsCount)) * 100));
    const isCompleted = totalAssessed >= totalItemsCount && totalItemsCount > 0;

    return {
      evaluatorNumber,
      userId: entry.userId,
      totalAssessed,
      freshRecords,
      semiFreshRecords,
      spoiledRecords,
      completionRate,
      isCompleted,
      firstActivity: entry.records[0]?.assessed_at || '',
      lastActivity: entry.records[entry.records.length - 1]?.assessed_at || '',
    };
  });
}

