
import { Category, SubCategory, ThemeMode } from '../types';
import { INITIAL_CATEGORIES } from '../constants';

// NOTE: Auth state is now managed in memory for security (Access Token)
// Refresh Token is HttpOnly cookie managed by browser
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];

// Local Storage Keys (Only for Data Cache, NOT Credentials)
const LS_KEYS = {
  CATEGORIES: 'modernNav_categories',
  BACKGROUND: 'modernNav_bg',
  PREFS: 'modernNav_prefs',
};

export const DEFAULT_BACKGROUND = 'radial-gradient(circle at 50% -20%, #334155, #0f172a, #020617)';

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

// Data Wrapper
interface StorageWrapper<T> {
  data: T;
  updatedAt: number;
  _isDirty: boolean;
}

// Backup Data Structure
interface BackupData {
  version: number;
  timestamp: number;
  categories: Category[];
  background?: string;
  prefs?: UserPreferences;
}

// --- Helpers ---

const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    return fallback;
  }
};

const safeLocalStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn("LS Write Failed", e);
  }
};

const wrapData = <T>(rawData: any, defaultVal: T): StorageWrapper<T> => {
  // 1. If it's already a valid StorageWrapper, return it directly.
  // This preserves the _isDirty flag and updatedAt timestamp from a previous save.
  if (rawData && typeof rawData === 'object' && 'updatedAt' in rawData && 'data' in rawData) {
    return rawData as StorageWrapper<T>;
  }
  
  // 2. If it's NOT a wrapper (null, undefined, or legacy raw data):
  // We treat it as a "Clean Cache" with timestamp 0.
  // - If it was null/undefined (new device), we use defaultVal.
  // - If it was legacy raw data, we use it as data but mark it clean so Cloud can override it.
  // This enforces "Cloud Priority" because Cloud data (usually updatedAt > 0) will always win 
  // against this local data (updatedAt = 0).
  const hasData = rawData !== null && rawData !== undefined;

  return {
    data: hasData ? rawData : defaultVal,
    updatedAt: 0, 
    _isDirty: false // KEY FIX: Always false. Non-wrapper data is treated as cache, not unsaved work.
  };
};

const getCleanData = <T>(key: string, defaultVal: T): T => {
  const raw = localStorage.getItem(key);
  const wrapper = raw ? safeJsonParse(raw, null) : null;
  if (wrapper && typeof wrapper === 'object' && 'data' in wrapper) {
    return (wrapper as StorageWrapper<T>).data;
  }
  // Handle legacy raw string for background
  if (key === LS_KEYS.BACKGROUND && typeof raw === 'string' && !raw.startsWith('{')) {
      return raw as unknown as T;
  }
  return (wrapper as T) || defaultVal;
};

// --- AUTH SERVICE INTERNALS ---

const onRefreshed = (token: string) => {
  _refreshSubscribers.forEach(cb => cb(token));
  _refreshSubscribers = [];
};

const addRefreshSubscriber = (cb: (token: string) => void) => {
  _refreshSubscribers.push(cb);
};

// Attempt to refresh token using HttpOnly cookie
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
    console.error("Refresh failed", e);
    return null;
  }
};

// Get valid token or refresh if missing/expired
const ensureAccessToken = async (): Promise<string | null> => {
  if (_accessToken) return _accessToken;

  if (_isRefreshing) {
    return new Promise(resolve => {
      addRefreshSubscriber(token => resolve(token));
    });
  }

  _isRefreshing = true;
  const newToken = await tryRefreshToken();
  _isRefreshing = false;
  
  if (newToken) {
    onRefreshed(newToken);
  } else {
    // If refresh fails, we are logged out
    _refreshSubscribers.forEach(cb => cb(''));
    _refreshSubscribers = [];
  }
  
  return newToken;
};

export const storageService = {

  init: () => {
    if (typeof window !== 'undefined') {
      // Try to silently refresh session on load
      tryRefreshToken();
      
      window.addEventListener('online', () => {
        storageService.syncPendingChanges();
      });
    }
  },

  // --- Auth Public API ---

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
    } catch (e) {
      console.warn("Logout cleanup failed", e);
    } finally {
      _accessToken = null;
    }
  },

  isSessionValid: (): boolean => {
    return !!_accessToken;
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

  // --- Data Sync ---

  _saveItem: async <T>(key: string, data: T, type: string) => {
    const timestamp = Date.now();
    const wrapper: StorageWrapper<T> = {
      data,
      updatedAt: timestamp,
      _isDirty: true
    };
    
    // 1. Optimistic UI Update (Local Cache)
    safeLocalStorageSet(key, JSON.stringify(wrapper));

    // 2. Cloud Sync
    try {
      const token = await ensureAccessToken();
      if (!token) {
          // If not logged in, we stop here. The data remains "Dirty" locally.
          // It will try to sync next time we are online/logged in via syncPendingChanges.
          return; 
      }

      const res = await fetch('/api/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type, data: wrapper })
      });

      if (res.ok) {
        // Ack: Server accepted. Mark clean locally.
        wrapper._isDirty = false;
        safeLocalStorageSet(key, JSON.stringify(wrapper));
      }
    } catch (e) {
      console.warn(`Sync failed for ${type}. Queued for retry.`);
    }
  },

  // Read Strategy: Load Local (Cache) -> Background Sync (Cloud Priority)
  fetchAllData: async (onCloudUpdate?: (data: any) => void): Promise<{ categories: Category[], background: string, prefs: UserPreferences, isDefaultCode: boolean }> => {
    
    // 1. Load from LocalStorage (Cache Layer)
    const rawCats = safeJsonParse(localStorage.getItem(LS_KEYS.CATEGORIES), null);
    const rawBg = localStorage.getItem(LS_KEYS.BACKGROUND);
    const rawPrefs = safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), null);
    
    // Normalize Background (Handle raw string legacy case)
    let bgWrapper: StorageWrapper<string>;
    try {
        const parsedBg = JSON.parse(rawBg || '""');
        if (parsedBg && typeof parsedBg === 'object' && 'updatedAt' in parsedBg) {
            bgWrapper = parsedBg;
        } else {
            bgWrapper = wrapData(rawBg || DEFAULT_BACKGROUND, DEFAULT_BACKGROUND);
        }
    } catch {
        bgWrapper = wrapData(rawBg || DEFAULT_BACKGROUND, DEFAULT_BACKGROUND);
    }

    const localData = {
      categories: wrapData<Category[]>(rawCats, INITIAL_CATEGORIES),
      background: bgWrapper,
      prefs: wrapData<UserPreferences>(rawPrefs, DEFAULT_PREFS),
      isDefaultCode: false
    };

    // 2. Background Sync (Cloud Layer)
    (async () => {
      try {
        const res = await fetch('/api/bootstrap');
        if (!res.ok) return;
        const cloudResponse = await res.json();
        
        const processSync = <T>(key: string, defaultVal: T, cloudRaw: any): { val: T, updated: boolean } => {
          const rawCurrent = localStorage.getItem(key);
          
          // Re-parse current local state carefully
          let currentWrapper: StorageWrapper<T>;
          if (!rawCurrent) {
             currentWrapper = { data: defaultVal, updatedAt: 0, _isDirty: false };
          } else {
             try {
                const parsed = JSON.parse(rawCurrent);
                // Check if it's a valid wrapper
                if (parsed && typeof parsed === 'object' && 'updatedAt' in parsed) {
                   currentWrapper = parsed;
                } else {
                   // Legacy data in LS -> Treat as old cache (TS=0, Dirty=False)
                   currentWrapper = { data: parsed as T, updatedAt: 0, _isDirty: false };
                }
             } catch {
                // Garbage in LS -> Reset
                currentWrapper = { data: defaultVal, updatedAt: 0, _isDirty: false };
             }
          }

          // Prepare Cloud Wrapper
          let cloudWrapper: StorageWrapper<T>;
          if (cloudRaw && typeof cloudRaw === 'object' && 'updatedAt' in cloudRaw) {
              // Valid Cloud Wrapper
              cloudWrapper = cloudRaw;
          } else {
              // Legacy Cloud Data (Raw) or Empty
              // If cloud data exists but is raw, give it precedence (TS=1) over clean local default (TS=0)
              cloudWrapper = { 
                  data: cloudRaw || defaultVal, 
                  updatedAt: cloudRaw ? 1 : 0, 
                  _isDirty: false 
              };
          }

          // SYNC DECISION LOGIC:
          // We override local if:
          // 1. Local is NOT dirty (no unsaved user changes).
          // 2. AND Cloud data is newer or different from default.
          
          // Note: If local is Default (TS=0) and Cloud has data (TS>=1), Cloud wins.
          // Note: If local is Legacy Cache (TS=0) and Cloud has data (TS>=1), Cloud wins.
          
          if (!currentWrapper._isDirty && cloudWrapper.updatedAt > currentWrapper.updatedAt) {
             safeLocalStorageSet(key, JSON.stringify(cloudWrapper));
             return { val: cloudWrapper.data, updated: true };
          }
          
          // Conflict: Local is dirty (User edited offline). 
          // We generally keep local and let the background sync (syncPendingChanges) push it later.
          // However, if the user explicitly wants Cloud Priority, we could argue to overwrite.
          // But "Dirty" implies explicit user intent *on this device* that hasn't saved. 
          // Overwriting it causes data loss. We keep local dirty state.
          
          return { val: currentWrapper.data, updated: false };
        };

        const syncedCats = processSync(LS_KEYS.CATEGORIES, INITIAL_CATEGORIES, cloudResponse.categories);
        const syncedBg = processSync(LS_KEYS.BACKGROUND, DEFAULT_BACKGROUND, cloudResponse.background);
        const syncedPrefs = processSync(LS_KEYS.PREFS, DEFAULT_PREFS, cloudResponse.prefs);

        if (syncedCats.updated || syncedBg.updated || syncedPrefs.updated) {
           if (onCloudUpdate) {
             onCloudUpdate({
                categories: syncedCats.val,
                background: syncedBg.val,
                prefs: syncedPrefs.val,
                isDefaultCode: cloudResponse.isDefaultCode
             });
           }
        }
        
        // Finally, if we have local dirty data, try to push it to cloud now
        storageService.syncPendingChanges();
        
      } catch (e) {
        // Network error or parsing error -> Keep using local cache
        console.warn("Bootstrap sync failed", e);
      }
    })();

    return {
      categories: localData.categories.data,
      background: localData.background.data,
      prefs: localData.prefs.data,
      isDefaultCode: localData.isDefaultCode
    };
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

  syncPendingChanges: async () => {
    const processKey = async (key: string, type: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const wrapper = safeJsonParse<StorageWrapper<any>>(raw, null as any);
      
      // If we have a dirty wrapper, try to push to server
      if (wrapper && wrapper._isDirty) {
        try {
           const token = await ensureAccessToken();
           if (!token) return; // Can't sync without auth

           const res = await fetch('/api/update', {
             method: 'POST',
             headers: { 
               'Content-Type': 'application/json',
               'Authorization': `Bearer ${token}` 
              },
             body: JSON.stringify({ type, data: wrapper })
           });

           if (res.ok) {
             wrapper._isDirty = false;
             safeLocalStorageSet(key, JSON.stringify(wrapper));
           }
        } catch (e) {
           // Keep dirty, try later
        }
      }
    };

    await Promise.all([
      processKey(LS_KEYS.CATEGORIES, 'categories'),
      processKey(LS_KEYS.BACKGROUND, 'background'),
      processKey(LS_KEYS.PREFS, 'prefs')
    ]);
  },

  // --- Backup & Restore ---
  exportData: () => {
    const categories = getCleanData<Category[]>(LS_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    const background = getCleanData<string>(LS_KEYS.BACKGROUND, DEFAULT_BACKGROUND);
    const prefs = getCleanData<UserPreferences>(LS_KEYS.PREFS, DEFAULT_PREFS);

    const backup: BackupData = {
      version: 1,
      timestamp: Date.now(),
      categories,
      background,
      prefs
    };

    const dataStr = JSON.stringify(backup, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `modern-nav-backup-${new Date().toISOString().slice(0, 10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  },

  importData: (file: File): Promise<Partial<BackupData>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const result = event.target?.result as string;
          const parsed = JSON.parse(result);
          
          let importedData: Partial<BackupData> = {};
          if (Array.isArray(parsed)) {
             importedData.categories = parsed;
          } else if (typeof parsed === 'object' && parsed !== null) {
             importedData = parsed as BackupData;
          } else {
             throw new Error('Invalid format');
          }
          resolve(importedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  },
  
  isDefaultCode: () => false,
  extendSession: () => {} 
};

storageService.init();
