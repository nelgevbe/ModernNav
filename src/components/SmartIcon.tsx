import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getFallbackFaviconUrls } from "../utils/favicon";
import { useViewportScale } from "../hooks/useViewportScale";

const FAVICON_LOAD_TIMEOUT_MS = 10000;

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

  const currentKey = `${icon}|${sourceUrl}|${faviconApi}`;
  const [prevKey, setPrevKey] = useState(currentKey);

  if (currentKey !== prevKey) {
    setPrevKey(currentKey);
    setFallbackIndex(0);
    setStatus("loading");
  }

  const fallbackUrls = useMemo(() => {
    if (icon && (icon.startsWith("http") || icon.startsWith("data:"))) {
      if (icon.startsWith("data:")) return [icon];

      if (sourceUrl && faviconApi) {
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
    setFallbackIndex((idx) => {
      const next = idx + 1;
      if (next < fallbackUrls.length) {
        setStatus("loading");
        return next;
      }
      setStatus("error");
      return idx;
    });
  }, [fallbackUrls.length]);

  // Image elements don't time out on hung HTTP requests — onError never fires
  // when the server accepts the connection but never responds. Without this,
  // a slow primary favicon API leaves every icon stuck on the loading skeleton
  // indefinitely. Fall through to the next URL after FAVICON_LOAD_TIMEOUT_MS.
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== "loading" || !currentSrc || currentSrc.startsWith("data:")) {
      return;
    }
    if (fallbackUrls.length <= 1) return;

    timeoutRef.current = setTimeout(() => {
      handleFallback();
    }, FAVICON_LOAD_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [currentSrc, status, fallbackUrls.length, handleFallback]);

  const handleLoad = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setStatus("loaded");
  }, []);

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
            decoding="async"
            className={`transition-opacity duration-300 ease-out object-contain ${imgClassName} ${
              status === "loaded" ? "opacity-100" : "opacity-0"
            }`}
            style={{ width: scaledSize, height: scaledSize }}
            onLoad={handleLoad}
            onError={handleFallback}
          />
        )}
      </div>
    );
  }

  const iconKey = icon.trim().toLowerCase();
  // lucide-react re-exports each icon as a LucideIcon component. The named
  // namespace also has helpers (`createLucideIcon`, etc.), so cast through
  // unknown to a Record indexed by string -> LucideIcon for lookup.
  const iconRegistry = LucideIcons as unknown as Record<string, LucideIcon | undefined>;
  let IconComponent: LucideIcon | null = null;
  const exactKey = icon.trim();
  IconComponent = iconRegistry[exactKey] ?? null;

  if (!IconComponent) {
    const allKeys = Object.keys(LucideIcons);
    const matchedKey = allKeys.find((k) => k.toLowerCase() === iconKey);
    if (matchedKey) {
      IconComponent = iconRegistry[matchedKey] ?? null;
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
