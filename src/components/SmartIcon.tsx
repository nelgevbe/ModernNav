import React, { useState } from "react";
import * as LucideIcons from "lucide-react";

interface SmartIconProps {
  icon: string | undefined;
  className?: string; // Container class
  imgClassName?: string; // Specific image class
  size?: number;
}

export const SmartIcon: React.FC<SmartIconProps> = ({
  icon,
  className = "",
  imgClassName = "",
  size = 20,
}) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  // Default fallback icon
  const DefaultIcon = LucideIcons.Globe;

  const [prevIcon, setPrevIcon] = useState(icon);
  if (icon !== prevIcon) {
    setPrevIcon(icon);
    setStatus("loading");
  }

  if (!icon) {
    return <DefaultIcon size={size} className={className} strokeWidth={1.5} />;
  }

  // Case 1: URL Image
  if (icon.startsWith("http") || icon.startsWith("data:")) {
    return (
      <div className={`relative flex items-center justify-center ${className}`}>
        {/* Placeholder / Fallback - Visible while loading or on error */}
        {(status === "loading" || status === "error") && (
          <DefaultIcon
            size={size}
            className={`absolute inset-0 m-auto text-slate-400/50 ${status === "loading" ? "animate-pulse" : ""}`}
            strokeWidth={1.5}
          />
        )}

        {/* Actual Image */}
        {status !== "error" && (
          <img
            src={icon}
            alt={icon}
            loading="lazy"
            decoding="async"
            className={`transition-opacity duration-300 ease-out object-contain ${imgClassName} ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
            style={{ width: size, height: size }}
            onLoad={() => setStatus("loaded")}
            onError={() => setStatus("error")}
          />
        )}
      </div>
    );
  }

  // Case 2: Lucide Icon
  const iconKey = icon.trim().toLowerCase();

  // Exhaustive search (case-insensitive)
  let IconComponent: any = null;

  // 1. Precise match (should be most common)
  const exactKey = icon.trim();
  IconComponent = (LucideIcons as any)[exactKey];

  // 2. Case-insensitive search
  if (!IconComponent) {
    const allKeys = Object.keys(LucideIcons);
    const matchedKey = allKeys.find((k) => k.toLowerCase() === iconKey);
    if (matchedKey) {
      IconComponent = (LucideIcons as any)[matchedKey];
    }
  }

  // 3. Fallback to default namespace property if exists (compatibility)
  if (!IconComponent && (LucideIcons as any).default) {
    const defaultExport = (LucideIcons as any).default;
    const defaultKeys = Object.keys(defaultExport);
    const matchedKey = defaultKeys.find((k) => k.toLowerCase() === iconKey);
    if (matchedKey) {
      IconComponent = defaultExport[matchedKey];
    }
  }

  if (IconComponent && (typeof IconComponent === "function" || typeof IconComponent === "object")) {
    const Component = IconComponent;
    return <Component size={size} className={className} strokeWidth={1.5} />;
  }

  // Case 3: Emoji or Fallback
  // If it's a short string (likely emoji) or starts with a typical emoji character range
  const isLikelyEmoji = icon.length <= 4 || /[\u1F600-\u1F64F]/.test(icon);

  if (isLikelyEmoji) {
    return (
      <span
        className={`leading-none filter drop-shadow-md select-none ${className}`}
        style={{ fontSize: size }}
      >
        {icon}
      </span>
    );
  }

  // Final fallback: Show default icon instead of the raw text name
  return <DefaultIcon size={size} className={className} strokeWidth={1.5} />;
};
