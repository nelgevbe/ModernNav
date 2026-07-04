import React from "react";
import { useBootstrap, useUpdateBackground, useUpdatePrefs } from "../../services/queries";
import { AppearanceTab } from "../settings/AppearanceTab";
import { DEFAULT_PREFS } from "../../constants/defaults";
import { DEFAULT_BACKGROUND } from "../../services/storage";
import { UserPreferences } from "../../types";

export const AppearancePage: React.FC = () => {
  const { data } = useBootstrap();
  const updateBackground = useUpdateBackground();
  const updatePrefs = useUpdatePrefs();

  const prefs = data?.prefs ?? DEFAULT_PREFS;
  const background = data?.background ?? DEFAULT_BACKGROUND;

  const handleUpdate = (newBg: string, prefsUpdate: Partial<UserPreferences>) => {
    if (newBg !== background) updateBackground.mutate(newBg);
    updatePrefs.mutate({ ...prefs, ...prefsUpdate });
  };

  return <AppearanceTab prefs={prefs} currentBackground={background} onUpdate={handleUpdate} />;
};

export default AppearancePage;
