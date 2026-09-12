import { ThemeMode } from "../types";

export type ResolvedTheme = "dark" | "light";

export const PREFERS_DARK_QUERY = "(prefers-color-scheme: dark)";

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(PREFERS_DARK_QUERY).matches
  );
}

// "auto"/unset follows the OS; prefersDark is injectable for tests.
export function resolveThemeMode(
  mode: ThemeMode | undefined,
  prefersDark: boolean = systemPrefersDark()
): ResolvedTheme {
  if (mode === ThemeMode.Dark) return "dark";
  if (mode === ThemeMode.Light) return "light";
  return prefersDark ? "dark" : "light";
}
