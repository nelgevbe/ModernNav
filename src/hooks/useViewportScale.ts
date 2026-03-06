import { useState, useEffect } from "react";

/**
 * Returns the linear scaling coefficient based on the viewport width.
 *
 * Design baseline: 1920px (1080p) is the 1.0x baseline.
 * - ≤ 1920px → 1.0  (including mobile/tablet, design baseline, not scaled down)
 * - 2560px   → ~1.33x (2K display)
 * - 3840px   → ~1.78x (4K display, upper limit constraint to prevent excessive magnification)
 *
 * Purpose: To correct hard-coded px values passed in JS style prop form,
 * such as cardHeight, cardWidth, maxContainerWidth, to make them consistent with
 * html { font-size: clamp(14px, 0.833vw, 26px) } The scaling system is consistent.
 *
 * @returns Scale factor of the current viewport（≥ 1.0）
 */
export const useViewportScale = (): number => {
  const BASE_WIDTH = 1920;
  const MAX_SCALE = 1.78; //4K maximum magnification to prevent excessive UI expansion

  const compute = () => {
    const w = window.innerWidth;
    const raw = w / BASE_WIDTH;
    return Math.min(Math.max(raw, 1.0), MAX_SCALE);
  };

  const [scale, setScale] = useState<number>(compute);

  useEffect(() => {
    const handleResize = () => setScale(compute());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return scale;
};
