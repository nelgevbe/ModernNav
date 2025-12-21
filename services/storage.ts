import { Category, ThemeMode } from "../types";
import { INITIAL_CATEGORIES } from "../constants";

// --- AUTH STATE ---
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];
let _saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const AUTH_KEYS = {
  ACCESS_TOKEN: "modernNav_token",
  TOKEN_EXPIRY: "modernNav_tokenExpiry",
};

// --- CONSTANTS ---
const LS_KEYS = {
  CATEGORIES: "modernNav_categories",
  BACKGROUND: "modernNav_bg",
  PREFS: "modernNav_prefs",
};

export const DEFAULT_BACKGROUND =
  "radial-gradient(circle at 50% -20%, #334155, #0f172a, #020617)";

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

// --- TYPES FOR EVENTS ---
type NotifyType = "success" | "error" | "info";
type NotifyListener = (type: NotifyType, message: string) => void;
type SyncStatusListener = (isSyncing: boolean) => void;

let _notifyListeners: NotifyListener[] = [];
let _syncStatusListeners: SyncStatusListener[] = [];

// --- HELPERS ---

const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    const parsed = JSON.parse(jsonString);
    // 处理旧版本包装数据的情况
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data as T;
    }
    return parsed as T;
  } catch {
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

// --- CORE SERVICE ---

export const storageService = {
  init: () => {
    if (typeof window === "undefined") return;
    const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const storedExpiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
    const currentTime = Date.now();

    // 仅在 Token 缺失或过期时尝试刷新
    if (
      !storedToken ||
      !storedExpiry ||
      parseInt(storedExpiry, 10) <= currentTime
    ) {
      storageService.tryRefreshToken();
    }
  },

  // --- AUTH LOGIC ---

  tryRefreshToken: async (): Promise<string | null> => {
    if (_isRefreshing) {
      return new Promise((resolve) => _refreshSubscribers.push(resolve));
    }
    _isRefreshing = true;

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh" }),
      });

      if (res.ok) {
        const data = await res.json();
        _accessToken = data.accessToken;
        const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
        safeLocalStorageSet(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        safeLocalStorageSet(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());

        _refreshSubscribers.forEach((cb) => cb(data.accessToken));
        return data.accessToken;
      } else if (res.status === 401 || res.status === 403) {
        storageService.clearAuth();
      }
      return null;
    } catch {
      return null;
    } finally {
      _isRefreshing = false;
      _refreshSubscribers = [];
    }
  },

  clearAuth: () => {
    _accessToken = null;
    localStorage.removeItem(AUTH_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_KEYS.TOKEN_EXPIRY);
  },

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
        const expiryTime = Date.now() + 24 * 60 * 60 * 1000;
        safeLocalStorageSet(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        safeLocalStorageSet(AUTH_KEYS.TOKEN_EXPIRY, expiryTime.toString());
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
      storageService.clearAuth();
      window.location.reload(); // 彻底重置应用状态
    }
  },

  // --- DATA OPERATIONS ---

  fetchAllData: async () => {
    let cloudData = null;
    try {
      const res = await fetch("/api/bootstrap");
      if (res.ok) cloudData = await res.json();
    } catch (e) {
      console.warn("Cloud offline, using local cache.");
    }

    const categories =
      cloudData?.categories ??
      safeJsonParse(
        localStorage.getItem(LS_KEYS.CATEGORIES),
        INITIAL_CATEGORIES
      );
    const background =
      cloudData?.background ??
      localStorage.getItem(LS_KEYS.BACKGROUND) ??
      DEFAULT_BACKGROUND;
    const prefs =
      cloudData?.prefs ??
      safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS);

    // 同步缓存
    safeLocalStorageSet(LS_KEYS.CATEGORIES, categories);
    safeLocalStorageSet(LS_KEYS.BACKGROUND, background);
    safeLocalStorageSet(LS_KEYS.PREFS, prefs);

    return {
      categories,
      background,
      prefs,
      isDefaultCode: !!cloudData?.isDefaultCode,
    };
  },

  // 💡 防抖保存逻辑
  _saveItem: async (key: string, data: any, type: string) => {
    safeLocalStorageSet(key, data);

    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);

    _saveDebounceTimer = setTimeout(async () => {
      const storedToken = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
      const token = _accessToken || storedToken;
      if (!token) return;

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

        if (res.status === 401) {
          const newToken = await storageService.tryRefreshToken();
          if (newToken) {
            return storageService._saveItem(key, data, type);
          }
          storageService.clearAuth();
        }

        if (!res.ok) throw new Error("D1 Sync Failed");
      } catch (e) {
        console.error("Sync Error:", e);
        storageService.notify("error", "云端同步失败，数据已暂存本地");
      } finally {
        storageService.notifySyncStatus(false);
      }
    }, 1000);
  },

  saveCategories: (categories: Category[]) =>
    storageService._saveItem(LS_KEYS.CATEGORIES, categories, "categories"),
  setBackground: (url: string) =>
    storageService._saveItem(LS_KEYS.BACKGROUND, url, "background"),
  savePreferences: (prefs: UserPreferences) =>
    storageService._saveItem(LS_KEYS.PREFS, prefs, "prefs"),

  // --- EVENTS ---
  subscribeNotifications: (l: NotifyListener) => {
    _notifyListeners.push(l);
    return () => (_notifyListeners = _notifyListeners.filter((i) => i !== l));
  },
  notify: (type: NotifyType, msg: string) =>
    _notifyListeners.forEach((l) => l(type, msg)),
  subscribeSyncStatus: (l: SyncStatusListener) => {
    _syncStatusListeners.push(l);
    return () =>
      (_syncStatusListeners = _syncStatusListeners.filter((i) => i !== l));
  },
  notifySyncStatus: (status: boolean) =>
    _syncStatusListeners.forEach((l) => l(status)),
};

storageService.init();
