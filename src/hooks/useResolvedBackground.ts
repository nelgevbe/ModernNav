import { useEffect, useState } from "react";
import { cachedDailyWallpaper, fetchDailyWallpaper, isDailyBackground } from "../utils/background";
import { DEFAULT_BACKGROUND } from "../constants/defaults";

// Resolves the "daily" sentinel (day-cached API call, default gradient on
// failure). "random" is a removed experiment — degrade to the default.
export function useResolvedBackground(background: string): string {
  const daily = isDailyBackground(background);
  const [dailyUrl, setDailyUrl] = useState<string | null>(() =>
    daily ? cachedDailyWallpaper() : null
  );

  useEffect(() => {
    if (!daily) return;
    let cancelled = false;
    fetchDailyWallpaper()
      .then((url) => {
        if (!cancelled) setDailyUrl(url);
      })
      .catch(() => {
        // keep the fallback gradient until a later retry succeeds
      });
    return () => {
      cancelled = true;
    };
  }, [daily]);

  if (background === "random") return DEFAULT_BACKGROUND;
  if (!daily) return background;
  return dailyUrl ?? DEFAULT_BACKGROUND;
}
