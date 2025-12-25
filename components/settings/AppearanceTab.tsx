import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Sliders,
  RotateCcw,
  Save,
  Palette,
  Wand2,
  Loader2,
  Check,
} from "lucide-react";
import { useLanguage } from "../../contexts/LanguageContext";
import { DEFAULT_BACKGROUND } from "../../services/storage";
import { getDominantColor } from "../../utils/color";

interface AppearanceTabProps {
  currentBackground: string;
  currentOpacity: number;
  currentThemeColor: string;
  currentThemeAuto: boolean;
  onUpdate: (url: string, opacity: number) => void;
  onUpdateTheme?: (color: string, auto: boolean) => void;
}

const PRESET_COLORS = [
  "#6366f1", // Indigo (Default)
  "#3b82f6", // Blue
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#84cc16", // Lime
  "#f59e0b", // Amber
  "#f97316", // Orange
  "#ef4444", // Red
  "#ec4899", // Pink
  "#8b5cf6", // Violet
  "#64748b", // Slate
  "#ffffff", // White
];

export const AppearanceTab: React.FC<AppearanceTabProps> = ({
  currentBackground,
  currentOpacity,
  currentThemeColor,
  currentThemeAuto,
  onUpdate,
  onUpdateTheme,
}) => {
  const { t } = useLanguage();

  // Local state for inputs (UI Preview)
  const [bgInput, setBgInput] = useState(currentBackground);
  const [opacityInput, setOpacityInput] = useState(currentOpacity);
  const [themeColorInput, setThemeColorInput] = useState(currentThemeColor);
  const [localAutoMode, setLocalAutoMode] = useState(currentThemeAuto);

  // Status and Loading states
  const [bgStatus, setBgStatus] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Color Picker Popover State
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });

  const colorPickerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close color picker when clicking outside or resizing
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setShowColorPicker(false);
      }
    };

    const handleResize = () => setShowColorPicker(false);

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleResetBackground = () => {
    setBgInput(DEFAULT_BACKGROUND);
    setBgStatus(t("bg_updated"));
    setTimeout(() => setBgStatus(""), 3000);
  };

  // This is the ONLY place where global state updates and API calls happen
  const handleUpdateSettings = () => {
    // 1. Update Background & Opacity
    onUpdate(bgInput, opacityInput);

    // 2. Update Theme Color & Auto Mode
    if (onUpdateTheme) {
      onUpdateTheme(themeColorInput, localAutoMode);
    }

    setBgStatus(t("bg_updated"));
    setTimeout(() => setBgStatus(""), 3000);
  };

  // Purely local state update for smooth 60fps dragging
  const handleColorPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setThemeColorInput(color);
    setLocalAutoMode(false);
  };

  const handlePresetSelect = (color: string) => {
    setThemeColorInput(color);
    setLocalAutoMode(false);
    setShowColorPicker(false);
  };

  const handleAutoExtract = async () => {
    if (!bgInput) return;
    setIsExtracting(true);
    setBgStatus(t("extracting_color"));
    try {
      const color = await getDominantColor(bgInput);
      setThemeColorInput(color);
      setLocalAutoMode(true);
      setBgStatus(t("theme_updated"));
    } catch (e) {
      setBgStatus("Extraction failed");
    } finally {
      setIsExtracting(false);
      setTimeout(() => setBgStatus(""), 3000);
    }
  };

  const toggleColorPicker = () => {
    if (!showColorPicker && colorPickerRef.current) {
      const rect = colorPickerRef.current.getBoundingClientRect();
      setPopoverPos({ top: rect.top, left: rect.left });
      setShowColorPicker(true);
    } else {
      setShowColorPicker(false);
    }
  };

  // Dynamic Styles: Overrides global CSS variables strictly within this tab
  // This enables real-time preview of buttons/accents without re-rendering the whole app
  const previewStyles = {
    "--theme-primary": themeColorInput,
    "--theme-hover": `color-mix(in srgb, ${themeColorInput}, black 10%)`,
    "--theme-active": `color-mix(in srgb, ${themeColorInput}, black 20%)`,
    "--theme-light": `color-mix(in srgb, ${themeColorInput}, white 30%)`,
  } as React.CSSProperties;

  return (
    <div
      className="p-8 w-full max-w-2xl mx-auto overflow-y-auto animate-fade-in custom-scrollbar"
      onScroll={() => {
        if (showColorPicker) setShowColorPicker(false);
      }}
      style={previewStyles}
    >
      <div className="bg-slate-800/40 p-8 rounded-2xl border border-white/[0.08] shadow-sm">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-[var(--theme-primary)]/10 rounded-xl text-[var(--theme-light)] transition-colors duration-200">
            <Sliders size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {t("background_settings")}
            </h3>
            <p className="text-sm text-slate-500">{t("background_desc")}</p>
          </div>
        </div>
        <div className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">
              {t("bg_url_label")}
            </label>
            <input
              type="text"
              value={bgInput}
              onChange={(e) => setBgInput(e.target.value)}
              placeholder={t("bg_url_placeholder")}
              className="w-full bg-slate-900/50 border border-white/[0.1] rounded-xl px-4 py-3 text-white placeholder-slate-700 focus:outline-none focus:border-[var(--theme-primary)] text-sm transition-all"
            />
          </div>
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                {t("label_opacity")}
              </label>
              <span className="text-[10px] text-slate-400 font-mono font-bold">
                {Math.round(opacityInput * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={opacityInput}
              onChange={(e) => setOpacityInput(Number(e.target.value))}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-[var(--theme-primary)]"
            />
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">
                {t("label_theme_color")}
              </label>
              {localAutoMode && (
                <span className="text-[10px] text-[var(--theme-primary)] font-bold flex items-center gap-1">
                  <Wand2 size={10} /> Auto
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Custom Color Picker Trigger */}
              <div className="relative flex-1" ref={colorPickerRef}>
                <button
                  onClick={toggleColorPicker}
                  className="w-full h-10 rounded-xl overflow-hidden border border-white/[0.1] bg-slate-900/50 flex items-center px-3 gap-3 hover:bg-white/5 transition-colors group"
                >
                  <div
                    className="w-6 h-6 rounded border-0 shadow-sm transition-transform group-active:scale-90"
                    style={{ backgroundColor: themeColorInput }}
                  />
                  <span className="text-xs font-mono text-slate-400 uppercase">
                    {themeColorInput}
                  </span>
                </button>
              </div>

              <button
                onClick={handleAutoExtract}
                disabled={isExtracting}
                className="h-10 px-4 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-xl text-xs font-bold uppercase tracking-wide flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {isExtracting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Wand2
                    size={14}
                    className={
                      localAutoMode
                        ? "text-[var(--theme-primary)]"
                        : "text-slate-500"
                    }
                  />
                )}
                <span className="hidden sm:inline">
                  {t("btn_auto_extract")}
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-white/[0.1] h-36 bg-slate-950/50 flex items-center justify-center relative shadow-inner">
            {bgInput.startsWith("http") || bgInput.startsWith("data:") ? (
              <img
                src={bgInput}
                alt="Preview"
                className="w-full h-full object-cover opacity-60"
                onError={(e) =>
                  ((e.target as HTMLImageElement).style.display = "none")
                }
              />
            ) : (
              <div
                className="w-full h-full opacity-60"
                style={{ background: bgInput }}
              ></div>
            )}
            {/* The Preview Card reacts instantly to themeColorInput */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-28 h-20 rounded-xl border border-white/20 backdrop-blur-xl flex items-center justify-center shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, rgba(255, 255, 255, ${opacityInput}), rgba(255, 255, 255, ${
                    opacityInput * 0.4
                  }))`,
                }}
              >
                <span
                  className="text-[10px] font-black text-white uppercase tracking-tighter drop-shadow-md"
                  style={{ color: themeColorInput }}
                >
                  Preview
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleResetBackground}
              className="flex-1 bg-white/5 hover:bg-white/10 text-slate-400 px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-white/5"
            >
              <RotateCcw size={16} /> {t("reset_bg_btn")}
            </button>
            <button
              onClick={handleUpdateSettings}
              className="flex-1 bg-[var(--theme-primary)] hover:bg-[var(--theme-hover)] text-white px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl shadow-[var(--theme-primary)]/30"
            >
              <Save size={16} /> {t("update_bg_btn")}
            </button>
          </div>
          {bgStatus && (
            <div className="p-3 rounded-xl text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-center animate-fade-in tracking-wider">
              {bgStatus}
            </div>
          )}
        </div>
      </div>

      {/* Popover Menu */}
      {showColorPicker &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed w-48 p-3 bg-[#0f172a] border border-white/10 rounded-xl shadow-2xl z-[9999] animate-fade-in ring-1 ring-white/5"
            style={{
              top: popoverPos.top,
              left: popoverPos.left,
              transform: "translateX(calc(-100% - 12px))",
            }}
          >
            <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
              Presets
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => handlePresetSelect(color)}
                  className={`w-8 h-8 rounded-lg border transition-transform hover:scale-110 active:scale-90 flex items-center justify-center ${
                    themeColorInput.toLowerCase() === color.toLowerCase()
                      ? "border-white ring-1 ring-white/50"
                      : "border-white/10"
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                >
                  {themeColorInput.toLowerCase() === color.toLowerCase() && (
                    <Check
                      size={12}
                      className={
                        color === "#ffffff" ? "text-black" : "text-white"
                      }
                      strokeWidth={3}
                    />
                  )}
                </button>
              ))}
            </div>

            <div className="pt-3 border-t border-white/10">
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                Custom Value
              </div>
              <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1.5 border border-white/5">
                <input
                  type="color"
                  value={themeColorInput}
                  onChange={handleColorPick}
                  className="w-6 h-6 rounded cursor-pointer bg-transparent p-0 border-0"
                />
                <span className="text-[10px] font-mono text-slate-300 uppercase flex-1 text-right">
                  {themeColorInput}
                </span>
              </div>
            </div>
            <div className="absolute top-3 -right-1.5 w-3 h-3 bg-[#0f172a] border-t border-r border-white/10 rotate-45 z-0"></div>
          </div>,
          document.body
        )}
    </div>
  );
};
