
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
  // REMOVED: AUTH_CODE, SESSION
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
  if (rawData && typeof rawData === 'object' && 'updatedAt' in rawData && 'data' in rawData) {
    return rawData as StorageWrapper<T>;
  }
  
  // FIX: Detect if we truly have local data or if we are falling back to defaults.
  // If rawData is present (legacy data), mark as dirty to preserve/sync it up.
  // If rawData is null/undefined (new device), mark as clean to allow cloud sync down.
  const hasData = rawData !== null && rawData !== undefined;

  return {
    data: hasData ? rawData : defaultVal,
    updatedAt: 0,
    _isDirty: hasData // Only dirty if explicit local data exists
  };
};

const getCleanData = <T>(key: string, defaultVal: T): T => {
  const raw = localStorage.getItem(key);
  const wrapper = raw ? safeJsonParse(raw, null) : null;
  if (wrapper && typeof wrapper === 'object' && 'data' in wrapper) {
    return (wrapper as StorageWrapper<T>).data;
  }
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
    // Basic check. Since Token is memory-only, refreshing page loses it 
    // until init() -> tryRefreshToken() completes.
    // UI might flicker to locked state briefly on reload, which is secure.
    return !!_accessToken;
  },
  
  // Note: Local check only. Server is source of truth.
  // This helps UI show "Logged In" state.
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

  // Helper: Save with Bearer Token
  _saveItem: async <T>(key: string, data: T, type: string) => {
    const timestamp = Date.now();
    const wrapper: StorageWrapper<T> = {
      data,
      updatedAt: timestamp,
      _isDirty: true
    };
    
    // 1. Optimistic UI Update
    safeLocalStorageSet(key, JSON.stringify(wrapper));

    // 2. Cloud Sync
    try {
      const token = await ensureAccessToken();
      if (!token) throw new Error("No Auth");

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
      console.warn(`Sync failed for ${type}. Queued.`);
    }
  },

  // Read Strategy: Load Local -> Background Sync
  fetchAllData: async (onCloudUpdate?: (data: any) => void): Promise<{ categories: Category[], background: string, prefs: UserPreferences, isDefaultCode: boolean }> => {
    // ... (Reading Logic remains mostly same, just fetching data) ...
    // Using existing implementation for READ mostly
    
    const rawCats = safeJsonParse(localStorage.getItem(LS_KEYS.CATEGORIES), null);
    const rawBg = localStorage.getItem(LS_KEYS.BACKGROUND);
    const rawPrefs = safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), null);
    
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
      isDefaultCode: false // We don't expose this via simple GET anymore for security without auth
    };
    
    // Migration Logic
    localData.categories.data = localData.categories.data.map((cat: any) => {
        if (cat.items && Array.isArray(cat.items) && !cat.subCategories) {
            return {
                id: cat.id,
                title: cat.title,
                subCategories: [{ id: `${cat.id}-general`, title: 'General', items: cat.items }]
            };
        }
        return cat;
    });

    // Background Sync
    (async () => {
      try {
        const res = await fetch('/api/bootstrap');
        if (!res.ok) return;
        const cloudResponse = await res.json();
        
        const processSync = <T>(key: string, defaultVal: T, cloudRaw: any): { val: T, updated: boolean } => {
          const rawCurrent = localStorage.getItem(key);
          let currentWrapper: StorageWrapper<T>;

          if (!rawCurrent) {
             currentWrapper = wrapData(defaultVal, defaultVal);
          } else {
             try {
                const parsed = JSON.parse(rawCurrent);
                if (key === LS_KEYS.BACKGROUND && typeof parsed === 'string') {
                   currentWrapper = wrapData(parsed, defaultVal);
                } else if (parsed && typeof parsed === 'object' && 'updatedAt' in parsed) {
                   currentWrapper = parsed;
                } else {
                   currentWrapper = wrapData(parsed, defaultVal);
                }
             } catch {
                currentWrapper = wrapData(key === LS_KEYS.BACKGROUND ? rawCurrent : defaultVal, defaultVal) as any;
             }
          }

          let cloudWrapper: StorageWrapper<T>;
          if (cloudRaw && typeof cloudRaw === 'object' && 'updatedAt' in cloudRaw) {
              cloudWrapper = cloudRaw;
          } else {
              cloudWrapper = { data: cloudRaw || defaultVal, updatedAt: 0, _isDirty: false };
          }

          // FIX logic: Allow update if local is NOT dirty OR cloud is newer
          if (cloudWrapper.updatedAt > currentWrapper.updatedAt && !currentWrapper._isDirty) {
             safeLocalStorageSet(key, JSON.stringify(cloudWrapper));
             return { val: cloudWrapper.data, updated: true };
          }
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
        storageService.syncPendingChanges();
      } catch (e) {
        // silent fail
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
      
      if (wrapper && wrapper._isDirty) {
        try {
           const token = await ensureAccessToken();
           if (!token) return; // Cannot sync if not logged in

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
        } catch (e) {}
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
          
          if (importedData.categories) {
            importedData.categories = importedData.categories.map((cat: any) => {
              if (cat.items && Array.isArray(cat.items) && !cat.subCategories) {
                return {
                  id: cat.id,
                  title: cat.title,
                  subCategories: [{ id: `${cat.id}-general`, title: 'General', items: cat.items }]
                };
              }
              return cat;
            });
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
  
  // Extend session is now irrelevant for client-side storage, 
  // but we can keep empty to satisfy interface if needed, or remove.
  extendSession: () => {} 
};

storageService.init();
