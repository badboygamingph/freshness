export type FreshnessClass = 'fresh' | 'semi-fresh' | 'spoiled';

export interface UserSession {
  userId: string;
  userName: string;
  startedAt: string;
  avatarSeed: string;
}

export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null; // null for top-level parent folder
  isParent: boolean;
  createdAt: string;
  description?: string;
}

export interface DatasetItem {
  id: string;
  name: string;
  parentFolder: string; // e.g. "FRESHNESS ASSESSMENT"
  subFolder: string;    // e.g. "fresh", "semi-fresh", "spoiled"
  imageUrl: string;
  description?: string;
  fileSize?: string;
  uploadedAt: string;
  tags?: string[];
}

export interface AssessmentRecord {
  id: string;
  user_id: string;
  image_id: string;
  image_name: string;
  image_url: string;
  parent_folder: string;
  sub_folder: string;
  classification: FreshnessClass;
  assessed_at: string;
  notes?: string;
  confidence?: 'high' | 'medium' | 'low';
}

// Input used when importing folders in bulk (name-based, resolved to ids on save)
export interface ImportFolderInput {
  name: string;
  parentName: string | null;
  isParent: boolean;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  tableName: string; // "freshness_assessments"
  autoSync: boolean;
  isConnected?: boolean;
  lastSyncAt?: string;
}

export interface UserDatasetSummary {
  evaluatorNumber: number;
  userId: string;
  totalAssessed: number;
  freshRecords: AssessmentRecord[];
  semiFreshRecords: AssessmentRecord[];
  spoiledRecords: AssessmentRecord[];
  completionRate: number;
  isCompleted: boolean;
  firstActivity: string;
  lastActivity: string;
  evaluatorLabel?: string;
  totalEvaluated?: number;
  freshCount?: number;
  semiFreshCount?: number;
  spoiledCount?: number;
  allRecords?: AssessmentRecord[];
}
