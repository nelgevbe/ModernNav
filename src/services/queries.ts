import { QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Category, UserPreferences, BootstrapResponse } from "../types";
import { apiClient } from "./apiClient";
import { INITIAL_CATEGORIES } from "../constants";
import { DEFAULT_PREFS, DEFAULT_BACKGROUND } from "../constants/defaults";

// --- QueryClient Singleton ---
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});

// --- Query Keys ---
export const queryKeys = {
  bootstrap: ["bootstrap"] as const,
  categories: ["categories"] as const,
  background: ["background"] as const,
  prefs: ["prefs"] as const,
};

// --- LocalStorage Persistence (for offline-first) ---
export const LS_KEYS = {
  CATEGORIES: "modernNav_categories",
  BACKGROUND: "modernNav_bg",
  PREFS: "modernNav_prefs",
};

export function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      return parsed.data as T;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeLS(key: string, value: unknown) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch (e) {
    console.warn("LS write failed:", e);
  }
}

// --- Bootstrap Query Hook ---
export function useBootstrap() {
  return useQuery<BootstrapResponse>({
    queryKey: queryKeys.bootstrap,
    queryFn: async () => {
      const data = await apiClient.request<BootstrapResponse>(`/api/bootstrap?_=${Date.now()}`);
      writeLS(LS_KEYS.CATEGORIES, data.categories);
      writeLS(LS_KEYS.BACKGROUND, data.background);
      writeLS(LS_KEYS.PREFS, data.prefs);
      return data;
    },
    placeholderData: () => {
      const categories = readLS<Category[]>(LS_KEYS.CATEGORIES, INITIAL_CATEGORIES);
      const background = localStorage.getItem(LS_KEYS.BACKGROUND) || DEFAULT_BACKGROUND;
      const prefs = readLS<UserPreferences>(LS_KEYS.PREFS, DEFAULT_PREFS);
      return {
        categories: Array.isArray(categories) ? categories : INITIAL_CATEGORIES,
        background: typeof background === "string" ? background : DEFAULT_BACKGROUND,
        prefs: prefs && typeof prefs === "object" ? prefs : DEFAULT_PREFS,
        isDefaultCode: false,
      };
    },
  });
}

// --- Update Categories Mutation ---
export function useUpdateCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (categories: Category[]) => {
      writeLS(LS_KEYS.CATEGORIES, categories);
      if (await apiClient.isAuthenticated()) {
        await apiClient.request("/api/update", {
          method: "POST",
          body: JSON.stringify({ type: "categories", data: categories }),
        });
      }
    },
    onMutate: async (newCategories) => {
      await qc.cancelQueries({ queryKey: queryKeys.bootstrap });
      const prev = qc.getQueryData<BootstrapResponse>(queryKeys.bootstrap);
      if (prev) {
        qc.setQueryData<BootstrapResponse>(queryKeys.bootstrap, {
          ...prev,
          categories: newCategories,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(queryKeys.bootstrap, ctx.prev);
      }
    },
  });
}

// --- Update Background Mutation ---
export function useUpdateBackground() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (background: string) => {
      writeLS(LS_KEYS.BACKGROUND, background);
      if (await apiClient.isAuthenticated()) {
        await apiClient.request("/api/update", {
          method: "POST",
          body: JSON.stringify({ type: "background", data: background }),
        });
      }
    },
    onMutate: async (newBg) => {
      await qc.cancelQueries({ queryKey: queryKeys.bootstrap });
      const prev = qc.getQueryData<BootstrapResponse>(queryKeys.bootstrap);
      if (prev) {
        qc.setQueryData<BootstrapResponse>(queryKeys.bootstrap, {
          ...prev,
          background: newBg,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.bootstrap, ctx.prev);
    },
  });
}

// --- Update Prefs Mutation ---
export function useUpdatePrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: UserPreferences) => {
      writeLS(LS_KEYS.PREFS, prefs);
      if (await apiClient.isAuthenticated()) {
        await apiClient.request("/api/update", {
          method: "POST",
          body: JSON.stringify({ type: "prefs", data: prefs }),
        });
      }
    },
    onMutate: async (newPrefs) => {
      await qc.cancelQueries({ queryKey: queryKeys.bootstrap });
      const prev = qc.getQueryData<BootstrapResponse>(queryKeys.bootstrap);
      if (prev) {
        qc.setQueryData<BootstrapResponse>(queryKeys.bootstrap, {
          ...prev,
          prefs: newPrefs,
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.bootstrap, ctx.prev);
    },
  });
}
