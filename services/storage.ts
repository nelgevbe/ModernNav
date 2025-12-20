import { Category, ThemeMode } from "../types";
import { INITIAL_CATEGORIES } from "../constants";

// --- AUTH STATE (In-Memory + Persistent) ---
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];

// Persistent storage keys
const AUTH_KEYS = {
  ACCESS_TOKEN: "modernNav_token",
  TOKEN_EXPIRY: "modernNav_tokenExpiry",
};

// --- EVENT LISTENERS ---
type NotifyType = "success" | "error" | "info";
type NotifyListener = (type: NotifyType, message: string) => void;
let _notifyListeners: NotifyListener[] = [];

type SyncStatusListener = (isSyncing: boolean) => void;
let _syncStatusListeners: SyncStatusListener[] = [];

// --- CONSTANTS ---
const LS_KEYS = {
  CATEGORIES: "modernNav_categories",
  BACKGROUND: "modernNav_bg",
  PREFS: "modernNav_prefs",
};

export const DEFAULT_BACKGROUND =
  "radial-gradient(circle at 50% -20%, #334155, #0f172a, #020617)";
const CURRENT_BACKUP_VERSION = 1;

export interface UserPreferences {
  cardOpacity: number;
  themeColor?: string;
  themeMode: ThemeMode;
}

const DEFAULT_PREFS: UserPreferences = {
  cardOpacity: 0.1,
  themeColor: "#6366f1",
  themeMode: ThemeMode.Dark,
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

// Robust JSON Parser that handles legacy wrappers automatically
const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);

    // MIGRATION LOGIC: Check if data is wrapped in old format { data: ..., _isDirty: ... }
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      // If we expect an array (like categories) and .data is an array, return .data
      if (Array.isArray(fallback) && Array.isArray(parsed.data)) {
        return parsed.data as T;
      }
      // If we expect an object (like prefs) and .data is object, return .data
      if (!Array.isArray(fallback) && typeof parsed.data === "object") {
        return parsed.data as T;
      }
    }

    return parsed as T;
  } catch (e) {
    console.warn("JSON Parse Failed:", e);
    return fallback;
  }
};

const safeLocalStorageSet = (key: string, value: any) => {
  try {
    const stringVal = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(key, stringVal);
  } catch (e) {
    console.warn("LS Write Failed", e);
  }
};

// --- AUTH LOGIC ---

const onRefreshed = (token: string) => {
  _refreshSubscribers.forEach((cb) => cb(token));
  _refreshSubscribers = [];
};

const tryRefreshToken = async (): Promise<string | null> => {
  try {
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "refresh" }),
    });

    if (res.ok) {
      const data = await res.json();
      _accessToken = data.accessToken;

      // Store token and expiry in localStorage
      if (typeof window !== "undefined") {
        const expiryTime = new Date().getTime() + 60 * 60 * 1000; // 1 hour from now
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
      }

      return data.accessToken;
    } else {
      _accessToken = null;
      // Clear stored tokens on refresh failure
      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
      }
      return null;
    }
  } catch (e) {
    return null;
  }
};

const ensureAccessToken = async (): Promise<string | null> => {
  // First check if we already have a token in memory
  if (_accessToken) return _accessToken;

  // If not, try to get it from localStorage
  if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const storedExpiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);

    if (storedToken && storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      const currentTime = new Date().getTime();
      const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds

      // Check if the token is still valid (not expired)
      if (expiryTime > currentTime) {
        _accessToken = storedToken;

        // If token will expire in less than 5 minutes, refresh it proactively
        if (expiryTime - currentTime < fiveMinutes) {
          if (_isRefreshing) {
            return new Promise((resolve) => _refreshSubscribers.push(resolve));
          }
          _isRefreshing = true;
          tryRefreshToken().then((newToken) => {
            _isRefreshing = false;
            onRefreshed(newToken || "");
          });
        }

        return _accessToken;
      } else {
        // Token expired, clear it
        localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
      }
    }
  }

  // If we still don't have a valid token, try to refresh
  if (_isRefreshing) {
    return new Promise((resolve) => _refreshSubscribers.push(resolve));
  }
  _isRefreshing = true;
  const newToken = await tryRefreshToken();
  _isRefreshing = false;
  onRefreshed(newToken || "");
  return newToken;
};

export const storageService = {
  init: () => {
    if (typeof window !== "undefined") {
      tryRefreshToken(); // Attempt silent refresh on load
    }
  },

  // --- EVENTS ---
  subscribeNotifications: (listener: NotifyListener) => {
    _notifyListeners.push(listener);
    return () => {
      _notifyListeners = _notifyListeners.filter((l) => l !== listener);
    };
  },
  notify: (type: NotifyType, message: string) => {
    _notifyListeners.forEach((l) => l(type, message));
  },
  subscribeSyncStatus: (listener: SyncStatusListener) => {
    _syncStatusListeners.push(listener);
    return () => {
      _syncStatusListeners = _syncStatusListeners.filter((l) => l !== listener);
    };
  },
  notifySyncStatus: (isSyncing: boolean) => {
    _syncStatusListeners.forEach((l) => l(isSyncing));
  },
  checkGlobalDirtyState: () => {},

  // --- AUTH ---
  login: async (code: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", code }),
      });
      if (res.ok) {
        const data = await res.json();
        _accessToken = data.accessToken;

        // Store token and expiry in localStorage
        if (typeof window !== "undefined") {
          const expiryTime = new Date().getTime() + 60 * 60 * 1000; // 1 hour from now
          localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
          localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
        }

        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
    } finally {
      _accessToken = null;
      // Clear stored tokens on logout
      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
      }
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await ensureAccessToken();
    return !!token;
  },

  updateAccessCode: async (
    currentCode: string,
    newCode: string
  ): Promise<boolean> => {
    const token = await ensureAccessToken();
    if (!token) return false;
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "update", currentCode, newCode }),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // --- CORE DATA OPERATIONS ---

  fetchAllData: async (): Promise<{
    categories: Category[];
    background: string;
    prefs: UserPreferences;
    isDefaultCode: boolean;
  }> => {
    let cloudData = null;

    // 1. Try Fetching from Cloud
    try {
      const res = await fetch("/api/bootstrap");
      if (res.ok) {
        cloudData = await res.json();
      }
    } catch (e) {
      console.warn("Network offline or failed, falling back to cache.");
    }

    // 2. Determine raw data source
    let finalCategories: any = INITIAL_CATEGORIES;
    let finalBackground: any = DEFAULT_BACKGROUND;
    let finalPrefs: any = DEFAULT_PREFS;
    let isDefaultCode = false;

    if (cloudData) {
      finalCategories = cloudData.categories;
      finalBackground = cloudData.background;
      finalPrefs = cloudData.prefs;
      isDefaultCode = !!cloudData.isDefaultCode;

      // Update Cache immediately with what we got
      safeLocalStorageSet(
        LS_KEYS.CATEGORIES,
        finalCategories || INITIAL_CATEGORIES
      );
      safeLocalStorageSet(
        LS_KEYS.BACKGROUND,
        finalBackground || DEFAULT_BACKGROUND
      );
      safeLocalStorageSet(LS_KEYS.PREFS, finalPrefs || DEFAULT_PREFS);
    } else {
      // Read from LocalStorage Cache
      const rawCat = localStorage.getItem(LS_KEYS.CATEGORIES);
      finalCategories = safeJsonParse(rawCat, INITIAL_CATEGORIES);

      const rawBg = localStorage.getItem(LS_KEYS.BACKGROUND);
      finalBackground = rawBg || DEFAULT_BACKGROUND;
      // Handle legacy string quirks from background
      if (
        typeof finalBackground === "string" &&
        finalBackground.startsWith('"')
      ) {
        try {
          finalBackground = JSON.parse(finalBackground);
        } catch {}
      }
      // Handle wrapped background object
      if (
        typeof finalBackground === "string" &&
        finalBackground.startsWith("{")
      ) {
        const parsed = safeJsonParse<any>(finalBackground, null);
        if (parsed && parsed.data) finalBackground = parsed.data;
      }

      finalPrefs = safeJsonParse(
        localStorage.getItem(LS_KEYS.PREFS),
        DEFAULT_PREFS
      );
    }

    // --- 3. FINAL DEFENSIVE VALIDATION (Prevents White Screen) ---

    // GUARANTEE: Categories must be an Array
    if (!Array.isArray(finalCategories)) {
      // One last attempt to unwrap if safeJsonParse didn't catch it deeply
      if (
        finalCategories &&
        typeof finalCategories === "object" &&
        Array.isArray((finalCategories as any).data)
      ) {
        finalCategories = (finalCategories as any).data;
      } else {
        console.warn(
          "Categories data corrupted, resetting to default to prevent crash."
        );
        finalCategories = INITIAL_CATEGORIES;
      }
    }

    // GUARANTEE: Background must be a String
    if (typeof finalBackground !== "string") {
      finalBackground = DEFAULT_BACKGROUND;
    }

    // GUARANTEE: Prefs must be an Object
    if (!finalPrefs || typeof finalPrefs !== "object") {
      finalPrefs = DEFAULT_PREFS;
    }

    return {
      categories: finalCategories,
      background: finalBackground,
      prefs: finalPrefs,
      isDefaultCode,
    };
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
      const res = await fetch("/api/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type, data }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          _accessToken = null;
          // Clear stored tokens on 401 error
          if (typeof window !== "undefined") {
            localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
            localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
          }
        }
        throw new Error(`Sync error ${res.status}`);
      }
    } catch (e) {
      console.error(`Sync failed for ${type}`, e);
      storageService.notify("error", `Cloud sync failed. Saved locally.`);
    } finally {
      storageService.notifySyncStatus(false);
    }
  },

  saveCategories: async (categories: Category[]) => {
    return storageService._saveItem(
      LS_KEYS.CATEGORIES,
      categories,
      "categories"
    );
  },

  setBackground: async (url: string) => {
    return storageService._saveItem(LS_KEYS.BACKGROUND, url, "background");
  },

  savePreferences: async (prefs: UserPreferences) => {
    return storageService._saveItem(LS_KEYS.PREFS, prefs, "prefs");
  },

  syncPendingChanges: async () => {},

  // --- BACKUP / RESTORE ---

  exportData: () => {
    const categories = safeJsonParse<Category[]>(
      localStorage.getItem(LS_KEYS.CATEGORIES),
      INITIAL_CATEGORIES
    );

    let background =
      localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND;
    if (background.startsWith('"'))
      try {
        background = JSON.parse(background);
      } catch {}

    const prefs = safeJsonParse<UserPreferences>(
      localStorage.getItem(LS_KEYS.PREFS),
      DEFAULT_PREFS
    );

    const backup: BackupData = {
      version: CURRENT_BACKUP_VERSION,
      timestamp: Date.now(),
      categories: Array.isArray(categories) ? categories : INITIAL_CATEGORIES,
      background,
      prefs,
    };

    const dataUri =
      "data:application/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(backup, null, 2));
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = `modern-nav-backup-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    link.click();
  },

  importData: (file: File): Promise<Partial<BackupData>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (Array.isArray(parsed)) {
            resolve({ categories: parsed });
          } else {
            resolve(parsed as BackupData);
          }
        } catch {
          reject(new Error("Invalid backup file"));
        }
      };
      reader.readAsText(file);
    });
  },
};

storageService.init();
