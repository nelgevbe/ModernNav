import { Category, ThemeMode } from "../types";
import { INITIAL_CATEGORIES } from "../constants";

// --- 状态管理 ---
let _accessToken: string | null = null;
let _isRefreshing = false;
let _refreshSubscribers: ((token: string) => void)[] = [];
let _saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const AUTH_KEYS = {
  ACCESS_TOKEN: "modernNav_token",
  TOKEN_EXPIRY: "modernNav_tokenExpiry",
};

const LS_KEYS = {
  CATEGORIES: "modernNav_categories",
  BACKGROUND: "modernNav_bg",
  PREFS: "modernNav_prefs",
};

export interface UserPreferences {
  cardOpacity: number;
  themeColor?: string;
  themeMode: ThemeMode;
}

// --- 事件系统 (用于 UI 反馈) ---
type NotifyType = "success" | "error" | "info";
type NotifyListener = (type: NotifyType, message: string) => void;
type SyncStatusListener = (isSyncing: boolean) => void;

let _notifyListeners: NotifyListener[] = [];
let _syncStatusListeners: SyncStatusListener[] = [];

// --- 辅助工具 ---
const safeJsonParse = <T>(jsonString: string | null, fallback: T): T => {
  if (!jsonString) return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
};

export const storage = {
  /**
   * 初始化：检查 Token 是否过期，尝试静默刷新
   */
  init: () => {
    if (typeof window === "undefined") return;
    const expiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
    if (expiry && parseInt(expiry, 10) <= Date.now()) {
      storage.tryRefreshToken();
    }
  },

  /**
   * 鉴权状态检查：防止管理页面白屏的关键
   */
  isAuthenticated: () => {
    if (typeof window === "undefined") return false;
    const token = localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
    const expiry = localStorage.getItem(AUTH_KEYS.TOKEN_EXPIRY);
    return !!(token && expiry && parseInt(expiry, 10) > Date.now());
  },

  getAccessToken: () => {
    if (typeof window === "undefined") return _accessToken;
    return _accessToken || localStorage.getItem(AUTH_KEYS.ACCESS_TOKEN);
  },

  /**
   * Token 刷新机制：带请求队列，防止多次并发刷新
   */
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
        // 过期时间为 24 小时
        const expiry = Date.now() + 24 * 60 * 60 * 1000;
        localStorage.setItem(AUTH_KEYS.ACCESS_TOKEN, data.accessToken);
        localStorage.setItem(AUTH_KEYS.TOKEN_EXPIRY, expiry.toString());

        _refreshSubscribers.forEach((cb) => cb(data.accessToken));
        return data.accessToken;
      }
      storage.clearAuth();
      return null;
    } catch (e) {
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
    if (typeof window !== "undefined") {
      window.location.href = "/"; // 强制清理后跳回主页
    }
  },

  /**
   * 数据加载：优先 D1，失败则降级到本地缓存
   */
  fetchAllData: async () => {
    try {
      const res = await fetch("/api/bootstrap");
      if (!res.ok) throw new Error("Fetch failed");

      const cloudData = await res.json();

      // 深度补全：确保 categories 内部格式正确，防止 React map 报错
      const categories = (cloudData.categories || []).map((cat: any) => ({
        ...cat,
        items: Array.isArray(cat.items) ? cat.items : [],
      }));

      localStorage.setItem(LS_KEYS.CATEGORIES, JSON.stringify(categories));
      if (cloudData.background)
        localStorage.setItem(LS_KEYS.BACKGROUND, cloudData.background);
      if (cloudData.prefs)
        localStorage.setItem(LS_KEYS.PREFS, JSON.stringify(cloudData.prefs));

      return { ...cloudData, categories };
    } catch (e) {
      console.warn("D1 Fetch Error, using local backup:", e);
      return {
        categories: safeJsonParse(
          localStorage.getItem(LS_KEYS.CATEGORIES),
          INITIAL_CATEGORIES
        ),
        background: localStorage.getItem(LS_KEYS.BACKGROUND),
        prefs: safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), null),
        isDefaultCode: true,
      };
    }
  },

  /**
   * 核心保存逻辑：带防抖、状态通知、自动刷新重试
   */
  _saveItem: async (key: string, data: any, type: string) => {
    // 1. 立即更新本地，保证 UI 响应速度
    localStorage.setItem(key, JSON.stringify(data));

    if (_saveDebounceTimer) clearTimeout(_saveDebounceTimer);

    _saveDebounceTimer = setTimeout(async () => {
      // 如果正在刷新 Token，将此次请求排入队列
      if (_isRefreshing) {
        _refreshSubscribers.push(() => storage._saveItem(key, data, type));
        return;
      }

      const token = storage.getAccessToken();
      if (!token) {
        storage.notify("info", "请先登录以同步数据");
        return;
      }

      storage.notifySyncStatus(true);
      try {
        const res = await fetch("/api/update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ type, data }),
        });

        // 2. 处理 Token 过期自动重试
        if (res.status === 401) {
          const newToken = await storage.tryRefreshToken();
          if (newToken) {
            // 刷新成功，重新触发保存
            return storage._saveItem(key, data, type);
          } else {
            storage.notify("error", "登录已失效，请重新登录");
            return;
          }
        }

        if (!res.ok) throw new Error("Server sync failed");

        storage.notify("success", "云端同步成功");
      } catch (e) {
        console.error("Sync Error:", e);
        storage.notify("error", "同步失败，数据已暂存浏览器");
      } finally {
        storage.notifySyncStatus(false);
      }
    }, 1000); // 1秒防抖
  },

  // --- 暴露给外部的简易接口 ---
  saveCategories: (cats: Category[]) =>
    storage._saveItem(LS_KEYS.CATEGORIES, cats, "categories"),
  setBackground: (url: string) =>
    storage._saveItem(LS_KEYS.BACKGROUND, url, "background"),
  savePreferences: (p: UserPreferences) =>
    storage._saveItem(LS_KEYS.PREFS, p, "prefs"),

  // --- UI 订阅方法 ---
  subscribeNotifications: (l: NotifyListener) => {
    _notifyListeners.push(l);
    return () => {
      _notifyListeners = _notifyListeners.filter((i) => i !== l);
    };
  },
  notify: (type: NotifyType, msg: string) =>
    _notifyListeners.forEach((l) => l(type, msg)),

  subscribeSyncStatus: (l: SyncStatusListener) => {
    _syncStatusListeners.push(l);
    return () => {
      _syncStatusListeners = _syncStatusListeners.filter((i) => i !== l);
    };
  },
  notifySyncStatus: (status: boolean) =>
    _syncStatusListeners.forEach((l) => l(status)),
};
