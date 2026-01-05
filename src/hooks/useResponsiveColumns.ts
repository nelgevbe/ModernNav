import { useState, useEffect } from "react";

/**
 * Calculates the effective number of columns based on window width,
 * but restricted by the user's preferred maximum columns.
 * Result is always Math.min(breakpointColumns, maxColumns)
 */
export const useResponsiveColumns = (maxColumns: number, maxContainerWidth: number, targetCardWidth: number) => {
  const [effectiveColumns, setEffectiveColumns] = useState(maxColumns);

  useEffect(() => {
    const handleResize = () => {
      const windowWidth = window.innerWidth;
      // Calculate the actual width of the container
      // Container has px-4 (16px * 2 = 32px) padding
      const containerPadding = 32;
      const availableWidth = Math.min(windowWidth, maxContainerWidth) - containerPadding;
      
      // Determine minimum width needed for a column (card + gap)
      // We use the user's preferred card width + 16px gap.
      // Default fallback to 124 if not provided (though it should be).
      const gap = 16;
      const effectiveCardWidth = targetCardWidth || 124;
      const minColumnWidth = effectiveCardWidth + gap; 

      let targetCoords = Math.floor(availableWidth / minColumnWidth);

      // Enforce reasonable bounds
      if (targetCoords < 2) targetCoords = 2;
      
      // The logic: Effective = Min(UserSetting, ScreenCapacity)
      setEffectiveColumns(Math.min(targetCoords, maxColumns));
    };

    // Initial calculation
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [maxColumns, maxContainerWidth, targetCardWidth]);

  return effectiveColumns;
};
