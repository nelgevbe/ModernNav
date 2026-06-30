import React from "react";
import { Plus, Save, Smile } from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { IconPicker } from "../IconPicker";
import { SmartIcon } from "../SmartIcon";
import type { ContentEditorState, ContentEditorActions } from "./useContentEditor";

interface LinkFormProps {
  state: ContentEditorState;
  actions: ContentEditorActions;
}

export const LinkForm: React.FC<LinkFormProps> = ({ state, actions }) => {
  const { t } = useLanguage();
  const { linkFormData, showIconPicker, iconSearch, editingLinkId, iconPickerRef, iconGroupRef } =
    state;
  const { setLinkFormData, setShowIconPicker, setIconSearch, closeLinkForm, handleSaveLink } =
    actions;

  return (
    <div
      className="surface-sunken border-t border-default p-4 animate-fade-in backdrop-blur-md relative z-20"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="label-xs">{t("label_title")}</label>
          <input
            type="text"
            value={linkFormData.title}
            onChange={(e) => setLinkFormData({ ...linkFormData, title: e.target.value })}
            placeholder={t("title_placeholder")}
            className="input-primary"
            autoFocus
          />
        </div>
        <div className="col-span-2 sm:col-span-1 relative">
          <label className="label-xs">{t("label_icon")}</label>
          <div className="relative group/icon" ref={iconGroupRef}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center justify-center pointer-events-none">
              <SmartIcon icon={linkFormData.icon} size={18} />
            </div>
            <input
              type="text"
              value={linkFormData.icon}
              onFocus={() => setShowIconPicker(true)}
              onChange={(e) => {
                setLinkFormData({ ...linkFormData, icon: e.target.value });
                setIconSearch(e.target.value);
              }}
              placeholder={t("icon_placeholder")}
              className="input-primary pl-10 pr-10"
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowIconPicker(!showIconPicker);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors"
            >
              <Smile size={18} />
            </button>
          </div>
          <IconPicker
            show={showIconPicker}
            onClose={() => setShowIconPicker(false)}
            value={linkFormData.icon || ""}
            onChange={(val) => setLinkFormData({ ...linkFormData, icon: val })}
            searchTerm={iconSearch}
            onSearchChange={setIconSearch}
            pickerRef={iconPickerRef}
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label-xs">{t("label_url")}</label>
          <input
            type="text"
            value={linkFormData.url}
            onChange={(e) => setLinkFormData({ ...linkFormData, url: e.target.value })}
            placeholder={t("url_placeholder")}
            className="input-primary"
          />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="label-xs">{t("label_desc")}</label>
          <input
            type="text"
            value={linkFormData.description}
            onChange={(e) => setLinkFormData({ ...linkFormData, description: e.target.value })}
            placeholder={t("desc_placeholder")}
            className="input-primary"
          />
        </div>
        <div className="col-span-2 flex gap-2 pt-1">
          <button onClick={closeLinkForm} className="flex-1 btn-secondary">
            {t("cancel")}
          </button>
          <button onClick={handleSaveLink} className="flex-1 btn-primary">
            {editingLinkId ? <Save size={14} /> : <Plus size={14} />}
            {editingLinkId ? t("update_link_card") : t("add_link_card")}
          </button>
        </div>
      </div>
    </div>
  );
};
