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
      if (Array.isArray(fallback) && Array.isArray(parsed.data)) return parsed.data as T;
      if (!Array.isArray(fallback) && typeof parsed.data === "object") return parsed.data as T;
    }
    return parsed as T;
  } catch (e) {
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

// 核心改进：完善刷新逻辑，防止误删 Token
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
        // 延长有效期到 24 小时，减少频繁刷新 KV
        const expiryTime = new Date().getTime() + 24 * 60 * 60 * 1000; 
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
      }
      return data.accessToken;
    } else if (res.status === 401 || res.status === 403) {
      // 只有在明确未授权时才清除，防止由于 KV 延迟导致的 500/429 错误误杀登录态
      _accessToken = null;
      localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    }
    return null;
  } catch (e) {
    return null; // 网络失败不执行清除
  }
};

const ensureAccessToken = async (): Promise<string | null> => {
  if (_accessToken) return _accessToken;

  if (typeof window !== "undefined") {
    const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const storedExpiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);

    if (storedToken && storedExpiry) {
      const expiryTime = parseInt(storedExpiry, 10);
      const currentTime = new Date().getTime();
      
      // 如果 Token 还没过期，直接使用，不再去请求后端
      if (expiryTime > currentTime) {
        _accessToken = storedToken;
        return _accessToken;
      }
    }
  }

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
      // 改进：初始化时先检查本地 Token 是否还有效，有效则不调用 tryRefreshToken
      const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      const storedExpiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
      const currentTime = new Date().getTime();
      
      if (!storedToken || !storedExpiry || parseInt(storedExpiry, 10) <= currentTime) {
        tryRefreshToken(); 
      }
    }
  },

  // --- EVENTS ---
  subscribeNotifications: (listener: NotifyListener) => {
    _notifyListeners.push(listener);
    return () => { _notifyListeners = _notifyListeners.filter((l) => l !== listener); };
  },
  notify: (type: NotifyType, message: string) => {
    _notifyListeners.forEach((l) => l(type, message));
  },
  subscribeSyncStatus: (listener: SyncStatusListener) => {
    _syncStatusListeners.push(listener);
    return () => { _syncStatusListeners = _syncStatusListeners.filter((l) => l !== listener); };
  },
  notifySyncStatus: (isSyncing: boolean) => {
    _syncStatusListeners.forEach((l) => l(isSyncing));
  },

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
        const expiryTime = new Date().getTime() + 24 * 60 * 60 * 1000;
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
        return true;
      }
      return false;
    } catch { return false; }
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
      localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
    }
  },

  isAuthenticated: async (): Promise<boolean> => {
    const token = await ensureAccessToken();
    return !!token;
  },

  // --- CORE DATA OPERATIONS ---
  fetchAllData: async () => {
    let cloudData = null;
    try {
      const res = await fetch("/api/bootstrap");
      if (res.ok) cloudData = await res.json();
    } catch (e) {
      console.warn("Network offline");
    }

    let finalCategories = INITIAL_CATEGORIES;
    let finalBackground = DEFAULT_BACKGROUND;
    let finalPrefs = DEFAULT_PREFS;
    let isDefaultCode = false;

    if (cloudData) {
      finalCategories = cloudData.categories || INITIAL_CATEGORIES;
      finalBackground = cloudData.background || DEFAULT_BACKGROUND;
      finalPrefs = cloudData.prefs || DEFAULT_PREFS;
      isDefaultCode = !!cloudData.isDefaultCode;

      safeLocalStorageSet(LS_KEYS.CATEGORIES, finalCategories);
      safeLocalStorageSet(LS_KEYS.BACKGROUND, finalBackground);
      safeLocalStorageSet(LS_KEYS.PREFS, finalPrefs);
    } else {
      finalCategories = safeJsonParse(localStorage.getItem(LS_KEYS.CATEGORIES), INITIAL_CATEGORIES);
      finalBackground = localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND;
      finalPrefs = safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS);
    }

    return { categories: finalCategories, background: finalBackground, prefs: finalPrefs, isDefaultCode };
  },

  // 改进：增加保存冷却时间，防止频繁操作 KV
  _lastSaveTime: 0,
  _saveItem: async (key: string, data: any, type: string) => {
    safeLocalStorageSet(key, data);

    const token = await ensureAccessToken();
    if (!token) return;

    // 强制限制保存间隔为 2 秒，防止 KV 写入冲突
    const now = Date.now();
    if (now - storageService._lastSaveTime < 2000) {
      storageService.notify("info", "保存太频繁，稍后将同步到云端");
      return; 
    }
    storageService._lastSaveTime = now;

    storageService.notifySyncStatus(true);
    try {
      const res = await fetch("/api/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ type, data }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          _accessToken = null;
          localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
          localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
        }
        throw new Error(`Sync error ${res.status}`);
      }
    } catch (e) {
      storageService.notify("error", "同步失败，已保存至本地");
    } finally {
      storageService.notifySyncStatus(false);
    }
  },

  saveCategories: async (categories: Category[]) => {
    return storageService._saveItem(LS_KEYS.CATEGORIES, categories, "categories");
  },
  setBackground: async (url: string) => {
    return storageService._saveItem(LS_KEYS.BACKGROUND, url, "background");
  },
  savePreferences: async (prefs: UserPreferences) => {
    return storageService._saveItem(LS_KEYS.PREFS, prefs, "prefs");
  },

  // --- BACKUP / RESTORE ---
  exportData: () => {
    const categories = safeJsonParse(localStorage.getItem(LS_KEYS.CATEGORIES), INITIAL_CATEGORIES);
    const background = localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND;
    const prefs = safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS);

    const backup: BackupData = {
      version: CURRENT_BACKUP_VERSION,
      timestamp: Date.now(),
      categories: Array.isArray(categories) ? categories : INITIAL_CATEGORIES,
      background,
      prefs,
    };

    const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  },
};

storageService.init();
