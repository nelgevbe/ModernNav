import React from "react";
import { useBootstrap, useUpdatePrefs } from "../../services/queries";
import { GeneralTab } from "../settings/GeneralTab";
import { DEFAULT_PREFS } from "../../constants/defaults";

export const GeneralPage: React.FC = () => {
  const { data } = useBootstrap();
  const updatePrefs = useUpdatePrefs();
  const prefs = data?.prefs ?? DEFAULT_PREFS;

  return (
    <GeneralTab prefs={prefs} onUpdate={(patch) => updatePrefs.mutate({ ...prefs, ...patch })} />
  );
};

export default GeneralPage;
