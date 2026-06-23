import { Category, UserPreferences, BootstrapResponse } from "../types";
import { INITIAL_CATEGORIES } from "../constants";
import { DEFAULT_PREFS } from "../constants/defaults";
import { apiClient } from "./apiClient";
import { handleApiError } from "../utils/errorHandler";

// --- Notification Listeners (kept for Toast compatibility) ---
type NotifyType = "success" | "error" | "info";
type NotifyListener = (type: NotifyType, message: string) => void;
let _notifyListeners: NotifyListener[] = [];

type SyncStatusListener = (isSyncing: boolean) => void;
let _syncStatusListeners: SyncStatusListener[] = [];

// --- Constants ---
const LS_KEYS = {
  CATEGORIES: "modernNav_categories",
  BACKGROUND: "modernNav_bg",
  PREFS: "modernNav_prefs",
};

export const DEFAULT_BACKGROUND = "radial-gradient(circle at 50% -20%, #334155, #0f172a, #020617)";
const CURRENT_BACKUP_VERSION = 1;

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
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      if (Array.isArray(fallback) && Array.isArray(parsed.data)) return parsed.data as T;
      if (!Array.isArray(fallback) && typeof parsed.data === "object") return parsed.data as T;
    }
    return parsed as T;
  } catch (e) {
    console.warn("JSON Parse Failed:", e);
    return fallback;
  }
};

// --- Storage Service (slimmed down) ---
// The dirty-flag/debounce/sync state machine has moved into TanStack Query mutations
// in services/queries.ts. This module now only owns: auth wrappers, listener
// subscriptions for legacy components (Toast/SyncIndicator), and import/export.
export const storageService = {
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

  // --- Auth ---
  login: async (code: string): Promise<boolean> => apiClient.login(code),
  logout: async () => apiClient.logout(),
  isAuthenticated: async (): Promise<boolean> => apiClient.isAuthenticated(),
  updateAccessCode: async (currentCode: string, newCode: string): Promise<boolean> => {
    try {
      await apiClient.request("/api/auth", {
        method: "POST",
        body: JSON.stringify({ action: "update", currentCode, newCode }),
      });
      return true;
    } catch {
      return false;
    }
  },

  // --- Local cache reads (used by query placeholderData) ---
  getLocalData: () => {
    const categories = safeJsonParse(localStorage.getItem(LS_KEYS.CATEGORIES), INITIAL_CATEGORIES);
    const background = localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND;
    const prefs = safeJsonParse(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS);
    return { categories, background, prefs, isDefaultCode: false };
  },

  // --- Backup ---
  exportData: () => {
    const backup: BackupData = {
      version: CURRENT_BACKUP_VERSION,
      timestamp: Date.now(),
      categories: safeJsonParse<Category[]>(
        localStorage.getItem(LS_KEYS.CATEGORIES),
        INITIAL_CATEGORIES
      ),
      background: localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND,
      prefs: safeJsonParse<UserPreferences>(localStorage.getItem(LS_KEYS.PREFS), DEFAULT_PREFS),
    };
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
    const link = document.createElement("a");
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
          resolve(Array.isArray(parsed) ? { categories: parsed } : parsed);
        } catch {
          reject(new Error("Invalid backup file"));
        }
      };
      reader.readAsText(file);
    });
  },
};

// Re-export error handler for downstream callers that imported it from here.
export { handleApiError };
export type { BootstrapResponse };
