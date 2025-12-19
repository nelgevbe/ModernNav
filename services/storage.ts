
import { Category, SubCategory, ThemeMode } from '../types';
import { INITIAL_CATEGORIES } from '../constants';

// NOTE: Auth state is now managed in memory for security (Access Token)
// Refresh Token is HttpOnly cookie managed by browser
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];

// Notification System
type NotifyType = 'success' | 'error' | 'info';
type NotifyListener = (type: NotifyType, message: string) => void;
let _notifyListeners: NotifyListener[] = [];

// Sync Status System
type SyncStatusListener = (isDirty: boolean) => void;
let _syncStatusListeners: SyncStatusListener[] = [];

// Local Storage Keys (Only for Data Cache, NOT Credentials)
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
  if (rawData && typeof rawData === 'object' && 'updatedAt' in rawData && 'data' in rawData) {
    return rawData as StorageWrapper<T>;
  }
  
  // 2. If it's NOT a wrapper, treat as Clean Cache (TS=0, Dirty=False)
  const hasData = rawData !== null && rawData !== undefined;

  return {
    data: hasData ? rawData : defaultVal,
    updatedAt: 0, 
    _isDirty: false 
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
      tryRefreshToken();
      window.addEventListener('online', () => {
        storageService.syncPendingChanges();
      });
      // Initial check on load (wait for hydration)
      setTimeout(() => storageService.checkGlobalDirtyState(), 1000);
    }
  },

  // --- Notification API ---
  subscribeNotifications: (listener: NotifyListener) => {
    _notifyListeners.push(listener);
    return () => {
      _notifyListeners = _notifyListeners.filter(l => l !== listener);
    };
  },

  notify: (type: NotifyType, message: string) => {
    _notifyListeners.forEach(l => l(type, message));
  },

  // --- Sync Status API ---
  subscribeSyncStatus: (listener: SyncStatusListener) => {
    _syncStatusListeners.push(listener);
    return () => {
        _syncStatusListeners = _syncStatusListeners.filter(l => l !== listener);
    };
  },

  notifySyncStatus: (isDirty: boolean) => {
    _syncStatusListeners.forEach(l => l(isDirty));
  },

  checkGlobalDirtyState: () => {
      const keys = [LS_KEYS.CATEGORIES, LS_KEYS.BACKGROUND, LS_KEYS.PREFS];
      let isDirty = false;
      for (const key of keys) {
          const raw = localStorage.getItem(key);
          if (raw) {
              try {
                  const parsed = JSON.parse(raw);
                  if (parsed && typeof parsed === 'object' && parsed._isDirty === true) {
                      isDirty = true;
                      break;
                  }
              } catch {}
          }
      }
      storageService.notifySyncStatus(isDirty);
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
        // Upon login, try syncing any pending data
        setTimeout(() => storageService.syncPendingChanges(), 500);
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
    
    // KEY FIX: Determine auth status BEFORE creating the wrapper.
    // If not authenticated, we treat this as a LOCAL save (dirty = false).
    // This prevents the "Syncing..." spinner from appearing for guests.
    let token = await ensureAccessToken();
    const isAuthenticated = !!token;

    const wrapper: StorageWrapper<T> = {
      data,
      updatedAt: timestamp,
      _isDirty: isAuthenticated // Only dirty if we plan to sync
    };
    
    // 1. Optimistic UI Update (Local Cache)
    safeLocalStorageSet(key, JSON.stringify(wrapper));
    
    // If not dirty (guest mode), we are done. Ensure spinner is off.
    if (!wrapper._isDirty) {
        storageService.checkGlobalDirtyState();
        return;
    }

    // 2. Cloud Sync (Authenticated)
    storageService.notifySyncStatus(true); // Turn on spinner

    const trySync = async (forceRefresh = false) => {
        try {
            if (forceRefresh) {
                _accessToken = null; 
                token = await ensureAccessToken();
            }
            
            if (!token) return; // Should not happen given logic above, but safe guard

            let res = await fetch('/api/update', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ type, data: wrapper })
            });

            if (res.status === 401 && !forceRefresh) {
                console.warn("Token expired, retrying sync...");
                await trySync(true); 
                return;
            }

            if (res.ok) {
                wrapper._isDirty = false;
                safeLocalStorageSet(key, JSON.stringify(wrapper));
            } else {
                throw new Error(`Server returned ${res.status}`);
            }
        } catch (e) {
            console.warn(`Sync failed for ${type}`, e);
            storageService.notify('error', `Sync failed for ${type}. Will retry later.`);
        } finally {
            storageService.checkGlobalDirtyState();
        }
    };

    await trySync();
  },

  // Read Strategy: Load Local (Cache) -> Background Sync (Cloud Priority)
  fetchAllData: async (onCloudUpdate?: (data: any) => void): Promise<{ categories: Category[], background: string, prefs: UserPreferences, isDefaultCode: boolean }> => {
    
    // 1. Load from LocalStorage (Cache Layer)
    const rawCats = safeJsonParse(localStorage.getItem(LS_KEYS.CATEGORIES), null);
    const rawBg = localStorage.getItem(LS_KEYS.BACKGROUND);
    const rawPrefs = safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), null);
    
    // Normalize Background
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
          
          let currentWrapper: StorageWrapper<T>;
          if (!rawCurrent) {
             currentWrapper = { data: defaultVal, updatedAt: 0, _isDirty: false };
          } else {
             try {
                const parsed = JSON.parse(rawCurrent);
                if (parsed && typeof parsed === 'object' && 'updatedAt' in parsed) {
                   currentWrapper = parsed;
                } else {
                   currentWrapper = { data: parsed as T, updatedAt: 0, _isDirty: false };
                }
             } catch {
                currentWrapper = { data: defaultVal, updatedAt: 0, _isDirty: false };
             }
          }

          let cloudWrapper: StorageWrapper<T>;
          if (cloudRaw && typeof cloudRaw === 'object' && 'updatedAt' in cloudRaw) {
              cloudWrapper = cloudRaw;
          } else {
              cloudWrapper = { 
                  data: cloudRaw || defaultVal, 
                  updatedAt: cloudRaw ? 1 : 0, 
                  _isDirty: false 
              };
          }

          if (!currentWrapper._isDirty && cloudWrapper.updatedAt > currentWrapper.updatedAt) {
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
        // silent fail for bootstrap
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
    // Check initially (might be pending changes from reload)
    storageService.checkGlobalDirtyState();

    const processKey = async (key: string, type: string) => {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const wrapper = safeJsonParse<StorageWrapper<any>>(raw, null as any);
      
      if (wrapper && wrapper._isDirty) {
        try {
           const token = await ensureAccessToken();
           if (!token) return; 

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
           } else if (res.status === 401) {
              // Trigger refresh via ensureAccessToken next time or explicitly here
              _accessToken = null; // Force refresh
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

    // Check again after attempt
    storageService.checkGlobalDirtyState();
  },

  // --- Backup & Restore ---
  exportData: () => {
    const categories = getCleanData<Category[]>(LS_KEYS.CATEGORIES, INITIAL_CATEGORIES);
    const background = getCleanData<string>(LS_KEYS.BACKGROUND, DEFAULT_BACKGROUND);
    const prefs = getCleanData<UserPreferences>(LS_KEYS.PREFS, DEFAULT_PREFS);

    const backup: BackupData = {
      version: CURRENT_BACKUP_VERSION,
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
             // Backward compatibility for raw arrays (Version 0)
             importedData.categories = parsed;
          } else if (typeof parsed === 'object' && parsed !== null) {
             // Version Check
             if (parsed.version && parsed.version > CURRENT_BACKUP_VERSION) {
                 reject(new Error(`Backup file version (${parsed.version}) is newer than supported (${CURRENT_BACKUP_VERSION}). Please update the app.`));
                 return;
             }
             importedData = parsed as BackupData;
          } else {
             reject(new Error('Invalid backup file format'));
             return;
          }
          resolve(importedData);
        } catch (error) {
          reject(new Error('Failed to parse backup file'));
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
