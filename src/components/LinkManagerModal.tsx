import React, { useState, useEffect } from "react";
import {
  X,
  Shield,
  LayoutGrid,
  Database,
  ShieldCheck,
  Image as ImageIcon,
  LogOut,
  Settings,
} from "lucide-react";
import { Category, UserPreferences } from "../types";
import { storageService } from "../services/storage";
import { useLanguage } from "../contexts/LanguageContext";
import { useViewportScale } from "../hooks/useViewportScale";
import { getIconSize } from "../utils/favicon";
import { AuthScreen } from "./settings/AuthScreen";
import { AppearanceTab } from "./settings/AppearanceTab";
import { DataTab } from "./settings/DataTab";
import { SecurityTab } from "./settings/SecurityTab";
import { ContentTab } from "./settings/ContentTab";
import { GeneralTab } from "./settings/GeneralTab";

interface LinkManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>;
  background: string;
  prefs: UserPreferences;
  onUpdateAppearance: (
    url: string,
    opacity: number,
    color?: string,
    layoutPrefs?: { width: number; cardWidth: number; cardHeight: number; cols: number },
    themeAuto?: boolean,
    extraPrefs?: Partial<UserPreferences>
  ) => void;

  isDefaultCode?: boolean;
}

export const LinkManagerModal: React.FC<LinkManagerModalProps> = ({
  isOpen,
  onClose,
  categories,
  setCategories,
  background,
  prefs,
  onUpdateAppearance,
  isDefaultCode = false,
}) => {
  const { t } = useLanguage();
  const viewportScale = useViewportScale();
  const s = (n: number) => getIconSize(n, viewportScale);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "content" | "appearance" | "general" | "data" | "security"
  >("content");

  useEffect(() => {
    if (isOpen) {
      storageService.isAuthenticated().then((isAuth) => {
        setIsAuthenticated(isAuth);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated) return;
    const interval = setInterval(() => {
      storageService.isAuthenticated().then((isAuth) => {
        if (!isAuth) setIsAuthenticated(false);
      });
    }, 60000);
    return () => clearInterval(interval);
  }, [isOpen, isAuthenticated]);

  if (!isOpen) return null;

  const syncCategories = async (newCategories: Category[]) => {
    setCategories(newCategories);
    try {
      await storageService.saveCategories(newCategories);
    } catch (e) {
      console.error("Failed to sync", e);
    }
  };

  const handleLogout = () => {
    storageService.logout();
    setIsAuthenticated(false);
  };

  const handleImport = (newCategories: Category[], newBg?: string, newPrefs?: UserPreferences) => {
    syncCategories(newCategories);
    if (newBg || newPrefs) {
      const bg = newBg || background;
      const opacity = newPrefs?.cardOpacity ?? prefs.cardOpacity;
      onUpdateAppearance(
        bg,
        opacity,
        newPrefs?.themeColor,
        undefined,
        newPrefs?.themeColorAuto ?? true
      );

      if (newBg) storageService.setBackground(newBg);
      if (newPrefs) storageService.savePreferences(newPrefs);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-root">
      <div
        className="absolute inset-0 transition-opacity"
        style={{ backgroundColor: "var(--modal-overlay)" }}
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[95vw] md:max-w-5xl border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh] animate-fade-in-down transition-all ring-1"
        style={{
          backgroundColor: "var(--modal-primary)",
          borderColor: "var(--modal-border)",
          boxShadow:
            "0 25px 50px -12px var(--modal-overlay-light), inset 0 0 0 1px var(--modal-border-light)",
        }}
      >
        {!isAuthenticated ? (
          <AuthScreen
            onAuthenticated={() => setIsAuthenticated(true)}
            onCancel={onClose}
            isDefaultCode={isDefaultCode}
          />
        ) : (
          <>
            {/* Header */}
            <div
              className="flex items-center justify-between px-6 py-4 border-b shrink-0 h-16"
              style={{
                backgroundColor: "var(--modal-primary-alt)",
                borderColor: "var(--modal-border)",
              }}
            >
              <div className="flex items-center gap-6">
                <h2
                  className="text-lg font-semibold flex items-center gap-2"
                  style={{ color: "var(--modal-text)" }}
                >
                  <Shield size={s(20)} style={{ color: "#34d399" }} /> {t("dashboard_manage")}
                </h2>
                <div
                  className="flex rounded-lg p-1 border"
                  style={{
                    backgroundColor: "var(--modal-overlay-light)",
                    borderColor: "var(--modal-border-light)",
                  }}
                >
                  <button
                    onClick={() => setActiveTab("content")}
                    className={`tab-pill ${
                      activeTab === "content" ? "tab-pill-active" : "tab-pill-inactive"
                    }`}
                  >
                    <LayoutGrid size={s(14)} className="inline mr-1 mb-0.5" /> {t("tab_content")}
                  </button>
                  <button
                    onClick={() => setActiveTab("general")}
                    className={`tab-pill ${
                      activeTab === "general" ? "tab-pill-active" : "tab-pill-inactive"
                    }`}
                  >
                    <Settings size={s(14)} className="inline mr-1 mb-0.5" />{" "}
                    {t("tab_general") || "General"}
                  </button>
                  <button
                    onClick={() => setActiveTab("appearance")}
                    className={`tab-pill ${
                      activeTab === "appearance" ? "tab-pill-active" : "tab-pill-inactive"
                    }`}
                  >
                    <ImageIcon size={s(14)} className="inline mr-1 mb-0.5" /> {t("tab_appearance")}
                  </button>
                  <button
                    onClick={() => setActiveTab("data")}
                    className={`tab-pill ${
                      activeTab === "data" ? "tab-pill-active" : "tab-pill-inactive"
                    }`}
                  >
                    <Database size={s(14)} className="inline mr-1 mb-0.5" /> {t("tab_data")}
                  </button>
                  <button
                    onClick={() => setActiveTab("security")}
                    className={`tab-pill ${
                      activeTab === "security" ? "tab-pill-active" : "tab-pill-inactive"
                    }`}
                  >
                    <ShieldCheck size={s(14)} className="inline mr-1 mb-0.5" /> {t("tab_security")}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                  style={{
                    color: "var(--modal-text-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "#f87171";
                    (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(239,68,68,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--modal-text-secondary)";
                    (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  }}
                >
                  <LogOut size={s(16)} /> <span className="hidden sm:inline">{t("logout")}</span>
                </button>
                <div
                  className="w-px"
                  style={{ height: `${s(20)}px`, backgroundColor: "var(--modal-border)" }}
                ></div>
                <button
                  onClick={onClose}
                  className="transition-colors p-1"
                  style={{ color: "var(--modal-text-secondary)" }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--modal-text)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--modal-text-secondary)";
                  }}
                >
                  <X size={s(24)} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div
              className="flex-1 overflow-hidden flex"
              style={{ backgroundColor: "var(--modal-surface)" }}
            >
              {activeTab === "content" && (
                <ContentTab
                  categories={categories}
                  onUpdateCategories={syncCategories}
                  faviconApi={prefs.faviconApi}
                />
              )}
              {activeTab === "general" && (
                <GeneralTab
                  prefs={prefs}
                  onUpdate={(newPrefs) =>
                    onUpdateAppearance(
                      background,
                      prefs.cardOpacity,
                      prefs.themeColor,
                      undefined,
                      prefs.themeColorAuto,
                      newPrefs
                    )
                  }
                />
              )}
              {activeTab === "appearance" && (
                <AppearanceTab
                  currentBackground={background}
                  currentOpacity={prefs.cardOpacity}
                  currentThemeColor={prefs.themeColor || "#6280a3"}
                  currentThemeAuto={prefs.themeColorAuto ?? true}
                  onUpdate={onUpdateAppearance}
                  currentLayout={{
                    width: prefs.maxContainerWidth ?? 900,
                    cardWidth: prefs.cardWidth ?? 96,
                    cardHeight: prefs.cardHeight ?? 96,
                    cols: prefs.gridColumns ?? 6,
                  }}
                />
              )}
              {activeTab === "data" && (
                <DataTab onImport={handleImport} background={background} prefs={prefs} />
              )}
              {activeTab === "security" && <SecurityTab />}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
