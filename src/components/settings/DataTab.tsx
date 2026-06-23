import React, { useRef, useState } from "react";
import { Database, Download, Upload, AlertCircle, HardDriveDownload } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { storageService } from "../../services/storage";
import { Category, UserPreferences } from "../../types";
import { useViewportScale } from "../../hooks/useViewportScale";
import { getIconSize } from "../../utils/favicon";
import { SettingsContainer, SettingsSection } from "./SettingsPrimitives";

interface DataTabProps {
  onImport: (categories: Category[], background?: string, prefs?: UserPreferences) => void;
  background: string;
  prefs: UserPreferences;
}

export const DataTab: React.FC<DataTabProps> = ({
  onImport,
  background: _background,
  prefs: _prefs,
}) => {
  const { t } = useLanguage();
  const viewportScale = useViewportScale();
  const s = (n: number) => getIconSize(n, viewportScale);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const handleExport = () => {
    storageService.exportData();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const importedData = await storageService.importData(file);

      onImport(importedData.categories || [], importedData.background, importedData.prefs);

      setImportStatus({ type: "success", message: t("import_success") });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : t("import_error");
      setImportStatus({
        type: "error",
        message,
      });
    }
    e.target.value = "";
    setTimeout(() => setImportStatus({ type: null, message: "" }), 6000);
  };

  return (
    <SettingsContainer>
      <div className="bg-blue-500/5 border border-blue-500/15 rounded-2xl p-5 flex gap-4 items-start">
        <div className="p-2.5 bg-blue-500/10 rounded-xl text-blue-400 shrink-0">
          <Database size={s(20)} />
        </div>
        <div>
          <h3 className="text-blue-400 font-bold tracking-tight mb-0.5 text-sm">
            {t("data_risk_title")}
          </h3>
          <p className="text-muted text-xs leading-relaxed">{t("data_risk_desc")}</p>
        </div>
      </div>

      <SettingsSection icon={Download} title={t("backup_config")} description={t("backup_desc")}>
        <button
          onClick={handleExport}
          className="btn-secondary w-full py-3 font-bold uppercase tracking-widest group"
        >
          <Download
            size={s(18)}
            className="text-blue-400 group-hover:translate-y-0.5 transition-transform"
          />{" "}
          {t("download_backup")}
        </button>
      </SettingsSection>

      <SettingsSection
        icon={HardDriveDownload}
        title={t("restore_config")}
        description={t("restore_desc")}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json"
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn-secondary w-full py-3 font-bold uppercase tracking-widest group"
        >
          <Upload
            size={s(18)}
            className="text-emerald-400 group-hover:-translate-y-0.5 transition-transform"
          />{" "}
          {t("select_import")}
        </button>
        {importStatus.type && (
          <div
            className={`mt-4 p-4 rounded-xl text-xs font-bold border flex items-center gap-3 ${
              importStatus.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border-red-500/20 text-red-400"
            }`}
          >
            <AlertCircle size={s(18)} /> {importStatus.message}
          </div>
        )}
      </SettingsSection>
    </SettingsContainer>
  );
};
