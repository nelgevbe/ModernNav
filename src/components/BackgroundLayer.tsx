import React from "react";
import { useResolvedBackground } from "../hooks/useResolvedBackground";

interface BackgroundLayerProps {
  background: string;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ background }) => {
  const resolved = useResolvedBackground(background);
  const isBackgroundUrl = resolved.startsWith("http") || resolved.startsWith("data:");

  return (
    <div className="fixed inset-0 z-0">
      {isBackgroundUrl ? (
        <img
          src={resolved}
          alt="Background"
          className="w-full h-full object-cover transition-opacity duration-700 opacity-100 dark:opacity-80"
          onError={(e) => {
            (e.target as HTMLImageElement).style.opacity = "0";
          }}
        />
      ) : (
        <div
          className="w-full h-full transition-opacity duration-700 opacity-90 dark:opacity-100"
          style={{ background: resolved }}
        />
      )}
      <div className="absolute inset-0 transition-colors duration-500 bg-white/10 dark:bg-slate-900/30" />
    </div>
  );
};
