import { useEffect } from "react";
import { useBootstrap } from "../services/queries";
import { getDominantColor } from "../utils/color";
import { DEFAULT_THEME_COLOR, DEFAULT_PREFS } from "../constants/defaults";

/**
 * Resolves the effective theme color and writes the related CSS variables onto
 * <html>, so every route (dashboard AND admin) reflects the saved theme color
 * the moment prefs change — no need to round-trip through the dashboard mount.
 *
 * Single source of truth for `--theme-*` variables. When `themeColorAuto` is on
 * the color is extracted from the background image; otherwise the saved
 * `themeColor` is used.
 */
export function useThemeColor() {
  const { data } = useBootstrap();
  const prefs = data?.prefs ?? DEFAULT_PREFS;
  const background = data?.background ?? "";
  const themeColorAuto = prefs.themeColorAuto ?? true;
  const savedColor = prefs.themeColor || DEFAULT_THEME_COLOR;

  useEffect(() => {
    let cancelled = false;

    const apply = (color: string) => {
      if (cancelled) return;
      const root = document.documentElement;
      root.style.setProperty("--theme-primary", color);
      root.style.setProperty("--theme-hover", `color-mix(in srgb, ${color}, black 10%)`);
      root.style.setProperty("--theme-active", `color-mix(in srgb, ${color}, black 20%)`);
      root.style.setProperty("--theme-light", `color-mix(in srgb, ${color}, white 30%)`);
    };

    const resolve = async () => {
      if (themeColorAuto && (background.startsWith("http") || background.startsWith("data:"))) {
        const extracted = await getDominantColor(background);
        apply(extracted);
      } else {
        apply(savedColor);
      }
    };

    resolve();
    return () => {
      cancelled = true;
    };
  }, [background, themeColorAuto, savedColor]);
}
