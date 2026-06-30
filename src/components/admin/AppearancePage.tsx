import React from "react";
import { useBootstrap, useUpdateBackground, useUpdatePrefs } from "../../services/queries";
import { AppearanceTab } from "../settings/AppearanceTab";
import { DEFAULT_PREFS, DEFAULT_LAYOUT } from "../../constants/defaults";
import { DEFAULT_BACKGROUND } from "../../services/storage";

export const AppearancePage: React.FC = () => {
  const { data } = useBootstrap();
  const updateBackground = useUpdateBackground();
  const updatePrefs = useUpdatePrefs();

  const prefs = data?.prefs ?? DEFAULT_PREFS;
  const background = data?.background ?? DEFAULT_BACKGROUND;

  return (
    <AppearanceTab
      currentBackground={background}
      currentOpacity={prefs.cardOpacity}
      currentThemeColor={prefs.themeColor || "#6280a3"}
      currentThemeAuto={prefs.themeColorAuto ?? true}
      currentLayout={{
        width: prefs.maxContainerWidth ?? DEFAULT_LAYOUT.maxContainerWidth,
        cardWidth: prefs.cardWidth ?? DEFAULT_LAYOUT.cardWidth,
        cardHeight: prefs.cardHeight ?? DEFAULT_LAYOUT.cardHeight,
        cols: prefs.gridColumns ?? DEFAULT_LAYOUT.gridColumns,
      }}
      onUpdate={(url, opacity, color, layout, themeAuto) => {
        if (url !== background) updateBackground.mutate(url);
        const merged = {
          ...prefs,
          cardOpacity: opacity,
          ...(color !== undefined ? { themeColor: color } : {}),
          ...(themeAuto !== undefined ? { themeColorAuto: themeAuto } : {}),
          ...(layout
            ? {
                maxContainerWidth: layout.width,
                cardWidth: layout.cardWidth,
                cardHeight: layout.cardHeight,
                gridColumns: layout.cols,
              }
            : {}),
        };
        updatePrefs.mutate(merged);
      }}
    />
  );
};

export default AppearancePage;
