import React, { useState } from "react";
import { Globe, Save, CheckCircle2, Link as LinkIcon, Plus, Trash2, Settings } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { UserPreferences, FooterLink } from "../../types";
import {
  DEFAULT_SITE_TITLE,
  DEFAULT_FAVICON_API,
  DEFAULT_FOOTER_GITHUB,
  DEFAULT_FOOTER_LINKS,
} from "../../constants/defaults";
import { useViewportScale } from "../../hooks/useViewportScale";
import { getIconSize } from "../../utils/favicon";
import { SettingsContainer, SettingsSection, SettingsRow } from "./SettingsPrimitives";

interface GeneralTabProps {
  prefs: UserPreferences;
  onUpdate: (newPrefs: Partial<UserPreferences>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ prefs, onUpdate }) => {
  const { t } = useLanguage();
  const viewportScale = useViewportScale();
  const s = (n: number) => getIconSize(n, viewportScale);
  const [formData, setFormData] = useState({
    siteTitle: prefs.siteTitle || DEFAULT_SITE_TITLE,
    faviconApi: prefs.faviconApi || DEFAULT_FAVICON_API,
    footerGithub: prefs.footerGithub || DEFAULT_FOOTER_GITHUB,
    footerLinks: prefs.footerLinks || DEFAULT_FOOTER_LINKS,
  });
  const [saveStatus, setSaveStatus] = useState(false);

  const handleSave = () => {
    onUpdate(formData);
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 3000);
  };

  const addFooterLink = () => {
    setFormData({
      ...formData,
      footerLinks: [...formData.footerLinks, { title: "", url: "" }],
    });
  };

  const removeFooterLink = (index: number) => {
    const newLinks = [...formData.footerLinks];
    newLinks.splice(index, 1);
    setFormData({ ...formData, footerLinks: newLinks });
  };

  const updateFooterLink = (index: number, field: keyof FooterLink, value: string) => {
    const newLinks = [...formData.footerLinks];
    newLinks[index] = { ...newLinks[index], [field]: value };
    setFormData({ ...formData, footerLinks: newLinks });
  };

  return (
    <SettingsContainer>
      <SettingsSection icon={Settings} title={t("tab_general")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SettingsRow label={t("label_site_title")}>
            <input
              type="text"
              value={formData.siteTitle}
              onChange={(e) => setFormData({ ...formData, siteTitle: e.target.value })}
              className="input-primary"
            />
          </SettingsRow>
          <SettingsRow label={t("label_github_link")}>
            <input
              type="text"
              value={formData.footerGithub}
              onChange={(e) => setFormData({ ...formData, footerGithub: e.target.value })}
              className="input-primary font-mono"
            />
          </SettingsRow>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Globe}
        title={t("label_favicon_api")}
        description={t("label_favicon_api_desc")}
      >
        <input
          type="text"
          value={formData.faviconApi}
          onChange={(e) => setFormData({ ...formData, faviconApi: e.target.value })}
          className="input-primary text-xs font-mono"
          placeholder="https://favicon.im/{domain}"
        />
      </SettingsSection>

      <SettingsSection
        icon={LinkIcon}
        title={t("label_friendship_links")}
        action={
          <button
            onClick={addFooterLink}
            className="flex items-center gap-1 px-3 py-1.5 bg-[var(--theme-primary)]/10 hover:bg-[var(--theme-primary)]/20 text-[var(--theme-primary)] rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors"
          >
            <Plus size={s(12)} /> {t("btn_add_link")}
          </button>
        }
      >
        <div className="space-y-2">
          {formData.footerLinks.map((link, index) => (
            <div key={index} className="flex gap-2 group animate-fade-in relative">
              <input
                type="text"
                value={link.title}
                onChange={(e) => updateFooterLink(index, "title", e.target.value)}
                placeholder="Title"
                className="input-primary w-32 text-xs"
              />
              <input
                type="text"
                value={link.url}
                onChange={(e) => updateFooterLink(index, "url", e.target.value)}
                placeholder="https://..."
                className="input-primary flex-1 text-xs font-mono"
              />
              <button
                onClick={() => removeFooterLink(index)}
                className="p-2 text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              >
                <Trash2 size={s(14)} />
              </button>
            </div>
          ))}
          {formData.footerLinks.length === 0 && (
            <p className="text-center py-2 text-muted text-[10px] italic">
              No friendship links configured.
            </p>
          )}
        </div>
      </SettingsSection>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          className={
            saveStatus
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 px-6 py-2.5 rounded-xl font-bold uppercase tracking-[0.2em] text-[10px] flex items-center gap-2"
              : "btn-primary w-auto py-2.5 px-6 tracking-[0.2em] text-[10px]"
          }
        >
          {saveStatus ? <CheckCircle2 size={s(14)} /> : <Save size={s(14)} />}
          <span>{saveStatus ? t("msg_saved") : t("btn_update_settings")}</span>
        </button>
      </div>
    </SettingsContainer>
  );
};
