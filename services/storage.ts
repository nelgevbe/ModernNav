
import { Category, ThemeMode } from '../types';
import { INITIAL_CATEGORIES } from '../constants';

// --- AUTH STATE (In-Memory) ---
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];

// --- EVENT LISTENERS ---
type NotifyType = 'success' | 'error' | 'info';
type NotifyListener = (type: NotifyType, message: string) => void;
let _notifyListeners: NotifyListener[] = [];

type SyncStatusListener = (isSyncing: boolean) => void;
let _syncStatusListeners: SyncStatusListener[] = [];

// --- CONSTANTS ---
const LS_KEYS = {
  CATEGORIES: 'modernNav_categories',
  BACKGROUND: 'modernNav_bg',
  PREFS: 'modernNav_prefs',
};

export const DEFAULT_BACKGROUND = 'radial-gradient(circle at 50% -20%, #334155, #0f172a, #020617)';
const CURRENT_BACKUP_VERSION = 1;

export interface UserPreferences {
  cardOpacity: number;
  themeColor?: string;
  themeMode: ThemeMode;
}

const DEFAULT_PREFS: UserPreferences = {
  cardOpacity: 0.10,
  themeColor: '#6366f1',
  themeMode: ThemeMode.Dark
};

// Backup Data Structure
interface BackupData {
  version: number;
  timestamp: number;
  categories: Category[];
  background?: string;
  prefs?: UserPreferences;
}

// --- HELPERS ---

// Safe Parse that handles both legacy wrapped data and new clean data
const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);
    // Migration: If data is wrapped in old format { data: ..., _isDirty: ... }, extract .data
    if (parsed && typeof parsed === 'object' && 'data' in parsed && '_isDirty' in parsed) {
      return parsed.data as T;
    }
    return parsed as T;
  } catch (e) {
    return fallback;
  }
};

const safeLocalStorageSet = (key: string, value: any) => {
  try {
    const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, stringVal);
  } catch (e) {
    console.warn("LS Write Failed", e);
  }
};

// --- AUTH LOGIC ---

const onRefreshed = (token: string) => {
  _refreshSubscribers.forEach(cb => cb(token));
  _refreshSubscribers = [];
};

const tryRefreshToken = async (): Promise<string | null> => {
  try {
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'refresh' })
    });
    
    if (res.ok) {
      const data = await res.json();
      _accessToken = data.accessToken;
      return data.accessToken;
    } else {
      _accessToken = null;
      return null;
    }
  } catch (e) {
    return null;
  }
};

const ensureAccessToken = async (): Promise<string | null> => {
  if (_accessToken) return _accessToken;
  if (_isRefreshing) {
    return new Promise(resolve => _refreshSubscribers.push(resolve));
  }
  _isRefreshing = true;
  const newToken = await tryRefreshToken();
  _isRefreshing = false;
  onRefreshed(newToken || '');
  return newToken;
};

export const storageService = {

  init: () => {
    if (typeof window !== 'undefined') {
      tryRefreshToken(); // Attempt silent refresh on load
    }
  },

  // --- EVENTS ---
  subscribeNotifications: (listener: NotifyListener) => {
    _notifyListeners.push(listener);
    return () => { _notifyListeners = _notifyListeners.filter(l => l !== listener); };
  },
  notify: (type: NotifyType, message: string) => {
    _notifyListeners.forEach(l => l(type, message));
  },
  subscribeSyncStatus: (listener: SyncStatusListener) => {
    _syncStatusListeners.push(listener);
    return () => { _syncStatusListeners = _syncStatusListeners.filter(l => l !== listener); };
  },
  notifySyncStatus: (isSyncing: boolean) => {
    _syncStatusListeners.forEach(l => l(isSyncing));
  },
  // No-op for compatibility with old code calls, logic moved to save methods
  checkGlobalDirtyState: () => {}, 

  // --- AUTH ---
  login: async (code: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', code })
      });
      if (res.ok) {
        const data = await res.json();
        _accessToken = data.accessToken;
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' })
      });
    } finally {
      _accessToken = null;
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await ensureAccessToken();
    return !!token;
  },

  updateAccessCode: async (currentCode: string, newCode: string): Promise<boolean> => {
    const token = await ensureAccessToken();
    if (!token) return false;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'update', currentCode, newCode })
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --- CORE DATA OPERATIONS ---

  // Strategy: Network First -> Cache Fallback
  fetchAllData: async (): Promise<{ categories: Category[], background: string, prefs: UserPreferences, isDefaultCode: boolean }> => {
    let cloudData = null;
    
    // 1. Try Fetching from Cloud
    try {
      const res = await fetch('/api/bootstrap');
      if (res.ok) {
        cloudData = await res.json();
      }
    } catch (e) {
      console.warn("Network offline or failed, falling back to cache.");
    }

    if (cloudData) {
      // 2a. Success: Update Cache & Return Cloud Data
      // We normalize data to ensure defaults if some fields are missing in DB
      const cleanData = {
        categories: cloudData.categories || INITIAL_CATEGORIES,
        background: cloudData.background || DEFAULT_BACKGROUND,
        prefs: cloudData.prefs || DEFAULT_PREFS,
        isDefaultCode: !!cloudData.isDefaultCode
      };

      safeLocalStorageSet(LS_KEYS.CATEGORIES, cleanData.categories);
      safeLocalStorageSet(LS_KEYS.BACKGROUND, cleanData.background);
      safeLocalStorageSet(LS_KEYS.PREFS, cleanData.prefs);

      return cleanData;

    } else {
      // 2b. Fail: Read from LocalStorage Cache
      const rawBg = localStorage.getItem(LS_KEYS.BACKGROUND);
      
      // Clean background string (handle potential JSON quotes from old saves)
      let bg = rawBg || DEFAULT_BACKGROUND;
      if (bg.startsWith('"') && bg.endsWith('"')) {
        try { bg = JSON.parse(bg); } catch {}
      }
      // Handle legacy wrapped object in background
      if (bg.startsWith('{')) {
         const parsed = safeJsonParse<any>(bg, null);
         if (parsed && parsed.data) bg = parsed.data;
      }

      return {
        categories: safeJsonParse<Category[]>(localStorage.getItem(LS_KEYS.CATEGORIES), INITIAL_CATEGORIES),
        background: bg,
        prefs: safeJsonParse<UserPreferences>(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS),
        isDefaultCode: false // Unknown if offline, assume safe
      };
    }
  },

  // Strategy: Optimistic UI (Update Local) -> Async Cloud Sync (If Admin)
  _saveItem: async (key: string, data: any, type: string) => {
    // 1. Optimistic Update (Local Cache)
    safeLocalStorageSet(key, data);

    // 2. Check Auth - If guest, stop here.
    const token = await ensureAccessToken();
    if (!token) return;

    // 3. Cloud Sync
    storageService.notifySyncStatus(true);
    
    try {
      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, data }) // Sending raw data, no wrappers
      });

      if (!res.ok) {
        if (res.status === 401) {
             // Token expired during operation
             _accessToken = null;
        }
        throw new Error(`Sync error ${res.status}`);
      }
    } catch (e) {
      console.error(`Sync failed for ${type}`, e);
      storageService.notify('error', `Cloud sync failed for ${type}. Changes saved locally.`);
    } finally {
      storageService.notifySyncStatus(false);
    }
  },

  saveCategories: async (categories: Category[]) => {
    return storageService._saveItem(LS_KEYS.CATEGORIES, categories, 'categories');
  },

  setBackground: async (url: string) => {
    return storageService._saveItem(LS_KEYS.BACKGROUND, url, 'background');
  },

  savePreferences: async (prefs: UserPreferences) => {
    return storageService._saveItem(LS_KEYS.PREFS, prefs, 'prefs');
  },

  // Legacy compatibility (no-op)
  syncPendingChanges: async () => {},

  // --- BACKUP / RESTORE ---
  
  exportData: () => {
    const categories = safeJsonParse<Category[]>(localStorage.getItem(LS_KEYS.CATEGORIES), INITIAL_CATEGORIES);
    
    let background = localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND;
    if (background.startsWith('"')) try { background = JSON.parse(background); } catch {}
    // Legacy check
    const bgParsed = safeJsonParse<any>(background, null);
    if (bgParsed && bgParsed.data) background = bgParsed.data;

    const prefs = safeJsonParse<UserPreferences>(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS);

    const backup: BackupData = {
      version: CURRENT_BACKUP_VERSION,
      timestamp: Date.now(),
      categories,
      background,
      prefs
    };

    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(JSON.stringify(backup, null, 2));
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `modern-nav-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  },

  importData: (file: File): Promise<Partial<BackupData>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (Array.isArray(parsed)) {
            // v0 format
            resolve({ categories: parsed });
          } else {
            // v1 format
            resolve(parsed as BackupData);
          }
        } catch {
          reject(new Error("Invalid backup file"));
        }
      };
      reader.readAsText(file);
    });
  }
};

storageService.init();
