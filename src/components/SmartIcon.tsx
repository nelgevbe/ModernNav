import React, { useState, useMemo, useCallback } from "react";
import * as LucideIcons from "lucide-react";
import { getFallbackFaviconUrls, isFaviconApiUrl } from "../utils/favicon";
import { useViewportScale } from "../hooks/useViewportScale";

interface SmartIconProps {
  icon: string | undefined;
  className?: string;
  imgClassName?: string;
  size?: number;
  style?: React.CSSProperties;
  faviconApi?: string;
  sourceUrl?: string;
}

export const SmartIcon: React.FC<SmartIconProps> = ({
  icon,
  className = "",
  imgClassName = "",
  size = 20,
  style,
  faviconApi,
  sourceUrl,
}) => {
  const scale = useViewportScale();
  const scaledSize = Math.round(size * scale);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [fallbackIndex, setFallbackIndex] = useState(0);

  const DefaultIcon = LucideIcons.Globe;

  const fallbackUrls = useMemo(() => {
    if (icon && (icon.startsWith("http") || icon.startsWith("data:"))) {
      if (icon.startsWith("data:")) return [icon];

      if (isFaviconApiUrl(icon) && sourceUrl && faviconApi) {
        return getFallbackFaviconUrls(sourceUrl, faviconApi);
      }

      return [icon];
    }
    return [];
  }, [icon, sourceUrl, faviconApi]);

  const currentSrc = useMemo(() => {
    if (!icon) return "";
    if (icon.startsWith("data:")) return icon;
    if (fallbackUrls.length > 0) {
      return fallbackUrls[Math.min(fallbackIndex, fallbackUrls.length - 1)];
    }
    return icon;
  }, [icon, fallbackUrls, fallbackIndex]);

  const handleFallback = useCallback(() => {
    const nextIndex = fallbackIndex + 1;
    if (nextIndex < fallbackUrls.length) {
      setFallbackIndex(nextIndex);
      setStatus("loading");
    } else {
      setStatus("error");
    }
  }, [fallbackIndex, fallbackUrls.length]);

  if (!icon) {
    return <DefaultIcon size={scaledSize} className={className} style={style} strokeWidth={1.5} />;
  }

  if (icon.startsWith("http") || icon.startsWith("data:")) {
    if (icon.startsWith("data:")) {
      return (
        <div className={`relative flex items-center justify-center ${className}`} style={style}>
          <img
            src={icon}
            alt=""
            loading="lazy"
            decoding="async"
            className={`object-contain ${imgClassName}`}
            style={{ width: scaledSize, height: scaledSize }}
          />
        </div>
      );
    }

    return (
      <div className={`relative flex items-center justify-center ${className}`} style={style}>
        {(status === "loading" || status === "error") && (
          <DefaultIcon
            size={scaledSize}
            className={`absolute inset-0 m-auto text-slate-400/50 ${status === "loading" ? "animate-pulse" : ""}`}
            style={style}
            strokeWidth={1.5}
          />
        )}

        {status !== "error" && (
          <img
            key={currentSrc}
            src={currentSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className={`transition-opacity duration-300 ease-out object-contain ${imgClassName} ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
            style={{ width: scaledSize, height: scaledSize }}
            onLoad={() => setStatus("loaded")}
            onError={handleFallback}
          />
        )}
      </div>
    );
  }

  const iconKey = icon.trim().toLowerCase();

  let IconComponent: React.ComponentType<any> | null = null;

  const exactKey = icon.trim();
  IconComponent = (LucideIcons as Record<string, any>)[exactKey];

  if (!IconComponent) {
    const allKeys = Object.keys(LucideIcons);
    const matchedKey = allKeys.find((k) => k.toLowerCase() === iconKey);
    if (matchedKey) {
      IconComponent = (LucideIcons as Record<string, any>)[matchedKey];
    }
  }

  if (!IconComponent && (LucideIcons as Record<string, any>).default) {
    const defaultExport = (LucideIcons as Record<string, any>).default;
    const defaultKeys = Object.keys(defaultExport);
    const matchedKey = defaultKeys.find((k) => k.toLowerCase() === iconKey);
    if (matchedKey) {
      IconComponent = defaultExport[matchedKey];
    }
  }

  if (IconComponent && (typeof IconComponent === "function" || typeof IconComponent === "object")) {
    const Component = IconComponent;
    return <Component size={scaledSize} className={className} style={style} strokeWidth={1.5} />;
  }

  const isLikelyEmoji = icon.length <= 4 || /[\u1F600-\u1F64F]/.test(icon);

  if (isLikelyEmoji) {
    return (
      <span
        className={`leading-none filter drop-shadow-md select-none ${className}`}
        style={{ fontSize: scaledSize, ...style }}
      >
        {icon}
      </span>
    );
  }

  return <DefaultIcon size={scaledSize} className={className} style={style} strokeWidth={1.5} />;
};
