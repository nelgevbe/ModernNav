import { useSyncExternalStore } from "react";
import { PREFERS_DARK_QUERY, systemPrefersDark } from "../utils/theme";

export function usePrefersDark(): boolean {
  return useSyncExternalStore(subscribe, systemPrefersDark, () => false);
}

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia(PREFERS_DARK_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}
