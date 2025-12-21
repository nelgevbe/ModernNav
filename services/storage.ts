import { Category, ThemeMode } from "../types";
import { INITIAL_CATEGORIES } from "../constants";

// --- AUTH STATE ---
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];
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

const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      if (Array.isArray(fallback) && Array.isArray(parsed.data))
        return parsed.data as T;
      if (!Array.isArray(fallback) && typeof parsed.data === "object")
        return parsed.data as T;
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
      if (typeof window !== "undefined") {
        const expiryTime = new Date().getTime() + 24 * 60 * 60 * 1000;
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
      }
      return data.accessToken;
    } else if (res.status === 401 || res.status === 403) {
      _accessToken = null;
      localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    }
    return null;
  } catch (e) {
    return null;
  }
};

const ensureAccessToken = async (): Promise<string | null> => {
  if (_accessToken) return _accessToken;
  if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const storedExpiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
    if (
      storedToken &&
      storedExpiry &&
      parseInt(storedExpiry, 10) > new Date().getTime()
    ) {
      _accessToken = storedToken;
      return _accessToken;
    }
  }
  if (_isRefreshing)
    return new Promise((resolve) => _refreshSubscribers.push(resolve));
  _isRefreshing = true;
  const newToken = await tryRefreshToken();
  _isRefreshing = false;
  onRefreshed(newToken || "");
  return newToken;
};

// --- STORAGE SERVICE ---

export const storageService = {
  init: () => {
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      const storedExpiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
      if (
        !storedToken ||
        !storedExpiry ||
        parseInt(storedExpiry, 10) <= new Date().getTime()
      ) {
        tryRefreshToken();
      }
    }
  },

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
        const expiryTime = new Date().getTime() + 24 * 60 * 60 * 1000;
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
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
      if (typeof window !== "undefined") {
        localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
      }
    }
  },

  // 💡 保持异步接口
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

  _lastSaveTime: 0,

  fetchAllData: async () => {
    let cloudData = null;
    try {
      const res = await fetch("/api/bootstrap");
      if (res.ok) cloudData = await res.json();
    } catch (e) {
      console.warn("Fetch failed");
    }

    let finalCategories =
      cloudData?.categories ||
      safeJsonParse(
        localStorage.getItem(LS_KEYS.CATEGORIES),
        INITIAL_CATEGORIES
      );
    let finalBackground =
      cloudData?.background ||
      localStorage.getItem(LS_KEYS.BACKGROUND) ||
      DEFAULT_BACKGROUND;
    let finalPrefs =
      cloudData?.prefs ||
      safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS);

    // 💡 原始代码中的背景图和 categories 防护逻辑
    if (!Array.isArray(finalCategories)) finalCategories = INITIAL_CATEGORIES;
    if (
      typeof finalBackground === "string" &&
      finalBackground.startsWith('"')
    ) {
      try {
        finalBackground = JSON.parse(finalBackground);
      } catch {}
    }
    if (
      typeof finalBackground === "string" &&
      finalBackground.startsWith("{")
    ) {
      const parsed = safeJsonParse<any>(finalBackground, null);
      if (parsed && parsed.data) finalBackground = parsed.data;
    }
    if (typeof finalBackground !== "string")
      finalBackground = DEFAULT_BACKGROUND;

    safeLocalStorageSet(LS_KEYS.CATEGORIES, finalCategories);
    safeLocalStorageSet(LS_KEYS.BACKGROUND, finalBackground);
    safeLocalStorageSet(LS_KEYS.PREFS, finalPrefs);

    return {
      categories: finalCategories,
      background: finalBackground,
      prefs: finalPrefs,
      isDefaultCode: !!cloudData?.isDefaultCode,
    };
  },

  _saveItem: async (key: string, data: any, type: string) => {
    safeLocalStorageSet(key, data);
    const token = await ensureAccessToken();
    if (!token) return;

    const now = Date.now();
    if (now - storageService._lastSaveTime < 1000) return;
    storageService._lastSaveTime = now;

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
      if (!res.ok && res.status === 401) {
        _accessToken = null;
        localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
      }
    } catch (e) {
      storageService.notify("error", `Cloud sync failed. Saved locally.`);
    } finally {
      storageService.notifySyncStatus(false);
    }
  },

  saveCategories: async (categories: Category[]) =>
    storageService._saveItem(LS_KEYS.CATEGORIES, categories, "categories"),
  setBackground: async (url: string) =>
    storageService._saveItem(LS_KEYS.BACKGROUND, url, "background"),
  savePreferences: async (prefs: UserPreferences) =>
    storageService._saveItem(LS_KEYS.PREFS, prefs, "prefs"),
  syncPendingChanges: async () => {},

  exportData: () => {
    const backup: BackupData = {
      version: CURRENT_BACKUP_VERSION,
      timestamp: Date.now(),
      categories: safeJsonParse<Category[]>(
        localStorage.getItem(LS_KEYS.CATEGORIES),
        INITIAL_CATEGORIES
      ),
      background:
        localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND,
      prefs: safeJsonParse<UserPreferences>(
        localStorage.getItem(LS_KEYS.PREFS),
        DEFAULT_PREFS
      ),
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
          resolve(Array.isArray(parsed) ? { categories: parsed } : parsed);
        } catch {
          reject(new Error("Invalid backup file"));
        }
      };
      reader.readAsText(file);
    });
  },
};

storageService.init();
